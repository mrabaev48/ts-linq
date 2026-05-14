import type {
  EntityMetadata,
  OrmMiddleware,
  RetryPolicy,
  SqlLogger,
  SoftDeleteOptions,
  SqlParameter,
  ConnectionPoolOptions,
  ConnectionHealthCheckOptions,
  SqlDialect
} from '@ts-linq/types';
import type {
  CircuitBreakerOptions,
  CircuitState,
  QueryPerformanceAnalysisOptions,
  QueryAnalysisInfo
} from './types';
import { logInternalError } from './utils/InternalLogger';
import { ResilienceManager } from './Resilience/ResilienceManager';
import { HealthMonitor } from './Health/HealthMonitor';

/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
export abstract class DatabaseProvider {
  protected connectionString: string;
  protected isConnected: boolean = false;
  protected inTransaction: boolean = false;
  protected logger?: SqlLogger;
  protected currentTraceId?: string;
  protected middlewares?: OrmMiddleware[];
  private lastExecuteStartedAt?: number;
  protected softDelete?: SoftDeleteOptions;
  protected retryPolicy?: RetryPolicy;
  /** Logical provider name for logging/metrics (postgresql|mysql|mssql|unknown). */
  protected providerName: string = 'unknown';
  /** Optional generic pool options forwarded to the underlying driver. */
  protected poolOptions?: ConnectionPoolOptions;
  /** Optional connection health-check scheduler options. */
  protected healthCheck?: ConnectionHealthCheckOptions;
  /** Optional circuit breaker options. */
  protected circuitOptions?: CircuitBreakerOptions;
  
  /** Resilience manager handling circuit breaker and retries */
  protected resilienceManager: ResilienceManager;
  /** Health monitor handling connection checks */
  protected healthMonitor: HealthMonitor;

  /** Optional query performance analysis configuration. */
  protected analysis?: QueryPerformanceAnalysisOptions;
  /** Internal accounting for analysis rate limiting. */
  private analysisEventsWindowStartMs?: number;
  private analysisEventsInWindow: number = 0;

  /**
   * Create a provider with a given connection string.
   * @param connectionString Provider-specific connection string.
   */
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy,
    poolOptions?: ConnectionPoolOptions,
    healthCheck?: ConnectionHealthCheckOptions,
    circuitOptions?: CircuitBreakerOptions
  ) {
    this.connectionString = connectionString;
    this.logger = logger;
    this.middlewares = middlewares;
    this.softDelete = softDelete;
    this.retryPolicy = retryPolicy;
    this.poolOptions = poolOptions;
    this.healthCheck = healthCheck;
    this.circuitOptions = circuitOptions;

    this.resilienceManager = new ResilienceManager(
      logger,
      this.providerName, // Note: providerName is 'unknown' here until subclass sets it, might need update later?
      circuitOptions,
      retryPolicy,
      (e) => this.isTransientError(e)
    );

    this.healthMonitor = new HealthMonitor(
      logger,
      this.providerName,
      healthCheck,
      this.resilienceManager
    );
  }

  /** Connect to the database. */
  public abstract connect(): Promise<void>;
  /** Disconnect from the database and release resources. */
  public abstract disconnect(): Promise<void>;
  /** Create a table for the provided entity metadata if it does not exist. */
  public abstract createTable(entityMetadata: EntityMetadata): Promise<void>;
  /** Return SQL dialect used by this provider (Strategy per provider). */
  public abstract getDialect(): SqlDialect;
  /** Insert an entity instance into its table and return the inserted entity. */
  public abstract insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
  /** Update an existing entity row and return the updated entity. */
  public abstract update<T extends object>(entity: T, entityClass: Function): Promise<T>;
  /** Delete an entity row. */
  public abstract delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
  /** Find an entity by primary key value. */
  public abstract findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null>;
  /** Get all entities of a given type. */
  public abstract findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
  /** Find entities by a simple conditions object (key/value pairs). */
  public abstract findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]>;
  /** Find entities where a column value is in a list. */
  public abstract findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]>;

  /** Insert many entities in a single transaction (default implementation). */
  public async insertMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]> {
    if (entities.length === 0) return entities;
    await this.beginTransaction();
    try {
      for (const entity of entities) {
        await this.insert(entity, entityClass);
      }
      await this.commitTransaction();
      return entities;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /** Update many entities in a single transaction (default implementation). */
  public async updateMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]> {
    if (entities.length === 0) return entities;
    await this.beginTransaction();
    try {
      for (const entity of entities) {
        await this.update(entity, entityClass);
      }
      await this.commitTransaction();
      return entities;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /** Upsert single entity: try update, fallback to insert when no rows updated. */
  public async upsert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    try {
      return await this.update(entity, entityClass);
    } catch {
      return await this.insert(entity, entityClass);
    }
  }

  /** Upsert many entities within a transaction. */
  public async upsertMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]> {
    if (entities.length === 0) return entities;
    await this.beginTransaction();
    try {
      for (const entity of entities) {
        await this.upsert(entity, entityClass);
      }
      await this.commitTransaction();
      return entities;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }
  /** Execute a SQL query and return rows mapped as generic objects. */
  public async executeQuery<T>(sql: string, params: readonly SqlParameter[] = []): Promise<T[]> {
    return await this.executeWithRetry<T[]>(() => this.doExecuteQuery<T>(sql, params), sql, params);
  }
  /** Provider-specific implementation of query execution. */
  protected abstract doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;

  /** Execute a non-query SQL statement and return affected row count. */
  public async executeNonQuery(sql: string, params: readonly SqlParameter[] = []): Promise<number> {
    return await this.executeWithRetry<number>(
      () => this.doExecuteNonQuery(sql, params),
      sql,
      params
    );
  }

  /**
   * Retry wrapper using ResilienceManager.
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<T> {
    const context = {
      sql,
      params,
      traceId: this.currentTraceId,
      inTransaction: this.inTransaction
    };

    return this.resilienceManager.execute(async () => {
      const startedAt = Date.now();
      this.lastExecuteStartedAt = startedAt;
      
      this.logger?.queryStart?.({
        sql,
        params,
        traceId: this.currentTraceId,
        provider: this.providerName
      });

      await this.beforeExecute(sql, params);

      try {
        const result = await fn();
        const durationMs = Date.now() - startedAt;
        
        this.logger?.queryEnd?.({
          sql,
          params,
          durationMs,
          traceId: this.currentTraceId,
          rows: Array.isArray(result)
            ? (result as unknown[]).length
            : typeof result === 'number'
              ? result
              : undefined,
          provider: this.providerName
        });

        await this.maybeAnalyzeQuery({ sql, params, durationMs });
        await this.afterExecute(sql, params, result);
        
        return result;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        this.logger?.queryEnd?.({
          sql,
          params,
          durationMs,
          traceId: this.currentTraceId,
          error: error as Error,
          provider: this.providerName
        });
        await this.maybeAnalyzeQuery({ sql, params, durationMs, error: error as Error });
        throw error;
      }
    }, context);
  }

  /** Configure query performance analysis at runtime. */
  public configureQueryAnalysis(options?: QueryPerformanceAnalysisOptions): void {
    this.analysis = { ...this.analysis, ...options };
  }

  /** Provider hook: obtain an EXPLAIN plan for a given SQL if supported. */
  protected async getExplainPlan(
    _sql: string,
    _params: readonly SqlParameter[]
  ): Promise<unknown | undefined> {
    // Default: not supported in base class
    return undefined;
  }

  /** Emit analysis event when thresholds are exceeded. */
  private async maybeAnalyzeQuery(info: {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    error?: Error;
  }): Promise<void> {
    const cfg = this.analysis;
    if (!cfg?.enabled) return;
    // only SELECT if configured
    const onlySelect = cfg.onlySelect ?? true;
    if (onlySelect && !/^\s*SELECT\b/i.test(info.sql)) return;
    // sampling
    const rate = Math.max(0, Math.min(1, cfg.sampleRate ?? 1));
    if (rate < 1 && Math.random() > rate) return;
    // rate limiting per minute
    const now = Date.now();
    const windowStart = this.analysisEventsWindowStartMs ?? now;
    const perMinute = Math.max(1, cfg.rateLimitPerMinute ?? 120);
    if (now - windowStart >= 60_000) {
      this.analysisEventsWindowStartMs = now;
      this.analysisEventsInWindow = 0;
    }
    if (this.analysisEventsInWindow >= perMinute) return;
    this.analysisEventsInWindow += 1;
    const explainT = cfg.explainThresholdMs ?? 500;
    const slowT = cfg.slowQueryThresholdMs ?? 1000;
    const needExplain = info.durationMs >= explainT && !info.error && !this.inTransaction;
    let plan: unknown | undefined;
    if (needExplain) {
      try {
        const timeoutMs = Math.max(1, cfg.explainTimeoutMs ?? 1000);
        const timed = Promise.race([
          this.getExplainPlan(info.sql, info.params),
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs))
        ]);
        plan = await timed;
      } catch (e) {
        logInternalError('DatabaseProvider.maybeAnalyzeQuery.explain', e);
      }
    }
    // size limit on plan (stringifiable only)
    const maxChars = Math.max(1024, cfg.maxExplainChars ?? 65536);
    const safePlan = (() => {
      if (plan === undefined || plan === null) return plan;
      try {
        const s = typeof plan === 'string' ? plan : JSON.stringify(plan);
        if (s.length <= maxChars) return plan;
        return s.slice(0, maxChars);
      } catch {
        return plan;
      }
    })();
    const payload: QueryAnalysisInfo = {
      sql: info.sql,
      params: info.params,
      durationMs: info.durationMs,
      provider: this.providerName,
      slow: info.durationMs >= slowT,
      explainPlan: safePlan,
      recommendations: cfg.recommendations ? this.deriveRecommendations(plan) : undefined
    };
    try {
      // Prefer dedicated hook if logger implements it; otherwise fallback to middleware afterExecute users
      this.logger?.analysis?.(payload);
      // Also notify middlewares if they expose analysis
      if (this.middlewares && this.middlewares.length > 0) {
        for (const mw of this.middlewares) {
          try {
            mw.analysis?.(payload);
          } catch (e) {
            logInternalError('DatabaseProvider.maybeAnalyzeQuery.middleware', e);
          }
        }
      }
    } catch (e) {
      logInternalError('DatabaseProvider.maybeAnalyzeQuery.logger', e);
    }
  }

  /** Heuristic recommendations from provider-agnostic plans. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private deriveRecommendations(_plan: unknown | undefined): ReadonlyArray<string> | undefined {
    // Minimal placeholder: concrete providers can override getExplainPlan with richer structures
    return undefined;
  }

  /** Basic transient error classifier. Providers may override for accuracy. */
  protected isTransientError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
    return (
      message.includes('deadlock') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('too many connections') ||
      message.includes('econnreset')
    );
  }

  /** Current circuit breaker state (for diagnostics/tests). */
  public get circuitStateLabel(): CircuitState {
    return this.resilienceManager.state;
  }

  /** Update circuit breaker options at runtime. */
  public configureCircuit(options: CircuitBreakerOptions): void {
    this.circuitOptions = { ...this.circuitOptions, ...options };
    this.resilienceManager.configureCircuit(options);
  }

  /** Soft delete configuration if enabled. */
  public get softDeleteOptions(): SoftDeleteOptions | undefined {
    return this.softDelete;
  }

  /** Configure soft-delete settings at runtime. */
  public configureSoftDelete(options?: SoftDeleteOptions): void {
    this.softDelete = options;
  }

  /** Expose provider label for metrics/loggers. */
  public get providerLabel(): string {
    return this.providerName;
  }
  /** Expose logger instance for downstream components. */
  public get loggerRef(): SqlLogger | undefined {
    return this.logger;
  }

  /** Configure connection pool and health-check options at runtime. */
  public configureConnection(options: {
    pool?: ConnectionPoolOptions;
    health?: ConnectionHealthCheckOptions;
  }): void {
    this.poolOptions = options.pool ?? this.poolOptions;
    
    if (options.health) {
      this.healthCheck = options.health;
      this.healthMonitor.configure(options.health);
    }
  }

  /**
   * Start periodic connection health checks if enabled.
   * Providers should call this after establishing a pool.
   */
  protected startHealthChecks(runPing: () => Promise<number>): void {
    this.healthMonitor.start(runPing);
  }

  /** Stop health check scheduler when disconnecting. */
  protected stopHealthChecks(): void {
    this.healthMonitor.stop();
  }

  /** Force-open the circuit for a specified duration (ms). */
  public forceOpen(reason: string, durationMs?: number): void {
    this.resilienceManager.forceOpen(reason, durationMs);
  }

  /** Manually reset circuit to closed state. */
  public manualReset(reason: string = 'manual reset'): void {
    this.resilienceManager.manualReset(reason);
  }

  /** Provider-specific implementation of non-query execution. */
  protected abstract doExecuteNonQuery(
    sql: string,
    params?: readonly SqlParameter[]
  ): Promise<number>;

  // Template Method hooks
  /** Called before each execute; override for logging/instrumentation. */
  protected async beforeExecute(sql: string, params: readonly SqlParameter[]): Promise<void> {
    if (!this.middlewares || this.middlewares.length === 0) return;
    const info = { sql, params, traceId: this.currentTraceId };
    for (const mw of this.middlewares) {
      try {
        await mw.beforeExecute?.(info);
      } catch (e) {
        logInternalError('DatabaseProvider.beforeExecute.middleware', e);
      }
    }
  }
  /** Called after each execute; override for logging/instrumentation. */
  protected async afterExecute(
    sql: string,
    params: readonly SqlParameter[],
    result: unknown
  ): Promise<void> {
    if (!this.middlewares || this.middlewares.length === 0) return;
    const rows = Array.isArray(result)
      ? (result as unknown[]).length
      : typeof result === 'number'
        ? result
        : undefined;
    const durationMs = this.lastExecuteStartedAt ? Date.now() - this.lastExecuteStartedAt : 0;
    const info = { sql, params, durationMs, traceId: this.currentTraceId, rows } as const;
    for (const mw of this.middlewares) {
      try {
        await mw.afterExecute?.(info);
      } catch (e) {
        logInternalError('DatabaseProvider.afterExecute.middleware', e);
      }
    }
  }

  /** Notify middleware that an entity instance has been materialized. */
  protected async notifyEntityMaterialized<T extends object>(
    entity: T,
    metadata?: EntityMetadata
  ): Promise<void> {
    if (!this.middlewares || this.middlewares.length === 0) return;
    const info: { entity: object; metadata?: EntityMetadata } = { entity, metadata };
    for (const mw of this.middlewares) {
      try {
        await mw.entityMaterialized?.(info);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyEntityMaterialized.middleware', e);
      }
    }
  }

  /** Begin a transaction. */
  public abstract beginTransaction(): Promise<void>;
  /** Commit the current transaction. */
  public abstract commitTransaction(): Promise<void>;
  /** Roll back the current transaction. */
  public abstract rollbackTransaction(): Promise<void>;

  /**
   * Whether the provider is currently connected.
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Whether a transaction is currently in progress.
   */
  public get inTransactionState(): boolean {
    return this.inTransaction;
  }
}
