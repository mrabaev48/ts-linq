import type {
  CircuitState,
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  EntityMetadata,
  OrmMiddleware,
  QueryAnalysisInfo,
  RetryPolicy,
  SoftDeleteOptions,
  SqlDialect,
  SqlLogger,
  SqlParameter
} from '@ts-linq/types';

import { HealthMonitor } from './Health/HealthMonitor';
import type { IDbCommandInterceptor } from './interceptors/IDbCommandInterceptor';
import type { IDbConnectionInterceptor } from './interceptors/IDbConnectionInterceptor';
import type { IDbTransactionInterceptor } from './interceptors/IDbTransactionInterceptor';
import type { IMaterializationInterceptor } from './interceptors/IMaterializationInterceptor';
import type {
  CommandEventData,
  ConnectionEventData,
  DbCommand,
  DbReader,
  TransactionEventData
} from './interceptors/types';
import { ResilienceManager } from './Resilience/ResilienceManager';
import type {
  CircuitBreakerOptions,
  IDatabaseProvider,
  QueryPerformanceAnalysisOptions
} from './types';
import { logInternalError } from './utils/InternalLogger';

/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
export abstract class DatabaseProvider implements IDatabaseProvider {
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

  /** EF-style command interceptors. */
  protected _commandInterceptors: IDbCommandInterceptor[] = [];
  /** EF-style connection interceptors. */
  protected _connectionInterceptors: IDbConnectionInterceptor[] = [];
  /** EF-style transaction interceptors. */
  protected _transactionInterceptors: IDbTransactionInterceptor[] = [];
  /** EF-style materialization interceptors. */
  protected _materializationInterceptors: IMaterializationInterceptor[] = [];

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
  public async connect(): Promise<void> {
    await this.notifyConnectionOpening();
    await this.doConnect();
    await this.notifyConnectionOpened();
  }

  /** Provider-specific connection logic. */
  protected abstract doConnect(): Promise<void>;

  /** Disconnect from the database and release resources. */
  public async disconnect(): Promise<void> {
    await this.notifyConnectionClosing();
    await this.doDisconnect();
    await this.notifyConnectionClosed();
  }

  /** Provider-specific disconnection logic. */
  protected abstract doDisconnect(): Promise<void>;
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
    return await this.executeWithRetry<T[]>(
      async () => this.doExecuteQuery<T>(sql, params),
      sql,
      params
    );
  }
  /** Provider-specific implementation of query execution. */
  protected abstract doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;

  /**
   * Convert a SQL string that uses '?' positional placeholders into the dialect-specific
   * placeholder format ($1/$2 for Postgres, @p1/@p2 for MSSQL, unchanged for MySQL).
   * Default implementation returns the SQL as-is (suitable for MySQL '?' style).
   * Concrete providers override this to apply their placeholder conversion.
   */
  public formatSqlWithParams(
    rawSql: string,
    params: readonly SqlParameter[]
  ): { sql: string; params: readonly SqlParameter[] } {
    return { sql: rawSql, params };
  }

  /**
   * Build dialect-specific paginated SQL for a single streaming chunk.
   * MySQL/Postgres: appends `LIMIT n OFFSET m`. Override in providers with different syntax.
   */
  protected buildChunkSql(baseSql: string, chunkLimit: number, offset: number): string {
    return `${baseSql} LIMIT ${chunkLimit} OFFSET ${offset}`;
  }

  /**
   * Stream rows from a SQL query as an AsyncIterable using chunked OFFSET pagination.
   * Memory is bounded to one chunk (1000 rows) at a time.
   * Override per provider for native cursor support.
   *
   * Note: calls doExecuteQuery directly — bypasses retry/circuit-breaker because
   * retry on a partially-yielded stream would produce duplicate rows.
   */
  public async *streamRows(
    baseSql: string,
    params: readonly SqlParameter[],
    startOffset: number = 0,
    maxRows?: number,
    signal?: AbortSignal
  ): AsyncIterable<Record<string, unknown>> {
    const CHUNK_SIZE = 1000;
    let offset = startOffset;
    let remaining: number = maxRows ?? Infinity;

    while (remaining > 0) {
      if (signal?.aborted) throw new Error('Operation aborted');
      const chunkLimit = Math.min(CHUNK_SIZE, remaining === Infinity ? CHUNK_SIZE : remaining);
      const chunkSql = this.buildChunkSql(baseSql, chunkLimit, offset);
      if (!this.isConnected) await this.connect();
      const rows = await this.doExecuteQuery<Record<string, unknown>>(chunkSql, params);
      if (rows.length === 0) break;
      for (const row of rows) {
        if (signal?.aborted) throw new Error('Operation aborted');
        yield row;
      }
      offset += rows.length;
      if (remaining !== Infinity) remaining -= rows.length;
      if (rows.length < chunkLimit) break;
    }
  }

  /** Execute a non-query SQL statement and return affected row count. */
  public async executeNonQuery(sql: string, params: readonly SqlParameter[] = []): Promise<number> {
    return await this.executeWithRetry<number>(
      async () => this.doExecuteNonQuery(sql, params),
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

  /**
   * Register EF-style interceptors partitioned by interface type.
   * Called by DbContext after InterceptorRegistry is constructed.
   */
  public configureInterceptors(opts: {
    command: IDbCommandInterceptor[];
    connection: IDbConnectionInterceptor[];
    transaction: IDbTransactionInterceptor[];
    materialization: IMaterializationInterceptor[];
  }): void {
    this._commandInterceptors = opts.command;
    this._connectionInterceptors = opts.connection;
    this._transactionInterceptors = opts.transaction;
    this._materializationInterceptors = opts.materialization;
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

  /**
   * Attach an additional SqlLogger alongside any existing one.
   * Both loggers receive every event; errors in one delegate do not affect the other.
   * Used by DbContext to wire the DiagnosticEmitter from options.logging.
   */
  public attachLogger(extra: SqlLogger): void {
    this.logger = this.logger ? DatabaseProvider.mergeLoggers(this.logger, extra) : extra;
  }

  private static mergeLoggers(a: SqlLogger, b: SqlLogger): SqlLogger {
    return {
      debug: (m, meta) => {
        try {
          a.debug(m, meta);
        } catch {
          /* ignore */
        }
        try {
          b.debug(m, meta);
        } catch {
          /* ignore */
        }
      },
      info: (m, meta) => {
        try {
          a.info(m, meta);
        } catch {
          /* ignore */
        }
        try {
          b.info(m, meta);
        } catch {
          /* ignore */
        }
      },
      warn: (m, meta) => {
        try {
          a.warn(m, meta);
        } catch {
          /* ignore */
        }
        try {
          b.warn(m, meta);
        } catch {
          /* ignore */
        }
      },
      error: (m, meta) => {
        try {
          a.error(m, meta);
        } catch {
          /* ignore */
        }
        try {
          b.error(m, meta);
        } catch {
          /* ignore */
        }
      },
      queryStart: (i) => {
        a.queryStart?.(i);
        b.queryStart?.(i);
      },
      queryEnd: (i) => {
        a.queryEnd?.(i);
        b.queryEnd?.(i);
      },
      retry: (i) => {
        a.retry?.(i);
        b.retry?.(i);
      },
      transactionStart: (i) => {
        a.transactionStart?.(i);
        b.transactionStart?.(i);
      },
      transactionEnd: (i) => {
        a.transactionEnd?.(i);
        b.transactionEnd?.(i);
      },
      connectionHealth: (i) => {
        a.connectionHealth?.(i);
        b.connectionHealth?.(i);
      },
      circuit: (i) => {
        a.circuit?.(i);
        b.circuit?.(i);
      },
      fallback: (i) => {
        a.fallback?.(i);
        b.fallback?.(i);
      },
      hedgedWin: (i) => {
        a.hedgedWin?.(i);
        b.hedgedWin?.(i);
      },
      analysis: (i) => {
        a.analysis?.(i);
        b.analysis?.(i);
      },
      crossQuery: (i) => {
        a.crossQuery?.(i);
        b.crossQuery?.(i);
      },
      cacheSize: (i) => {
        a.cacheSize?.(i);
        b.cacheSize?.(i);
      }
    };
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
  /** Called before each execute; invokes middlewares and command interceptors. */
  protected async beforeExecute(sql: string, params: readonly SqlParameter[]): Promise<void> {
    if (this.middlewares && this.middlewares.length > 0) {
      const info = { sql, params, traceId: this.currentTraceId };
      for (const mw of this.middlewares) {
        await mw.beforeExecute?.(info);
      }
    }
    if (this._commandInterceptors.length > 0) {
      const isReader = /^\s*SELECT\b/i.test(sql);
      const cmd: DbCommand = { sql, params, traceId: this.currentTraceId };
      const ev: CommandEventData = { commandText: sql, isReader };
      for (const ic of this._commandInterceptors) {
        if (isReader) {
          await ic.readerExecuting?.(cmd, ev);
        } else {
          await ic.nonQueryExecuting?.(cmd, ev);
        }
      }
    }
  }

  /** Called after each execute; invokes middlewares and command interceptors. */
  protected async afterExecute(
    sql: string,
    params: readonly SqlParameter[],
    result: unknown
  ): Promise<void> {
    const durationMs = this.lastExecuteStartedAt ? Date.now() - this.lastExecuteStartedAt : 0;
    if (this.middlewares && this.middlewares.length > 0) {
      const rows = Array.isArray(result)
        ? (result as unknown[]).length
        : typeof result === 'number'
          ? result
          : undefined;
      const info = { sql, params, durationMs, traceId: this.currentTraceId, rows } as const;
      for (const mw of this.middlewares) {
        try {
          await mw.afterExecute?.(info);
        } catch (e) {
          logInternalError('DatabaseProvider.afterExecute.middleware', e);
        }
      }
    }
    if (this._commandInterceptors.length > 0) {
      const isReader = /^\s*SELECT\b/i.test(sql);
      const cmd: DbCommand = { sql, params, traceId: this.currentTraceId };
      const ev: CommandEventData = { commandText: sql, durationMs, isReader };
      for (const ic of this._commandInterceptors) {
        try {
          if (isReader) {
            const dbReader: DbReader = { rows: Array.isArray(result) ? (result as unknown[]) : [] };
            await ic.readerExecuted?.(cmd, ev, dbReader);
          } else {
            const affected = typeof result === 'number' ? result : 0;
            await ic.nonQueryExecuted?.(cmd, ev, affected);
          }
        } catch (e) {
          logInternalError('DatabaseProvider.afterExecute.commandInterceptor', e);
        }
      }
    }
  }

  /**
   * Notify middleware and materialization interceptors that an entity was materialized.
   * Returns the (potentially modified) entity instance.
   */
  protected async notifyEntityMaterialized<T extends object>(
    entity: T,
    metadata?: EntityMetadata
  ): Promise<T> {
    if (this.middlewares && this.middlewares.length > 0) {
      const info: { entity: object; metadata?: EntityMetadata } = { entity, metadata };
      for (const mw of this.middlewares) {
        try {
          // eslint-disable-next-line @typescript-eslint/await-thenable
          await mw.entityMaterialized?.(info);
        } catch (e) {
          logInternalError('DatabaseProvider.notifyEntityMaterialized.middleware', e);
        }
      }
    }
    if (this._materializationInterceptors.length > 0) {
      const ev = { entityType: entity.constructor };
      let instance: object = entity;
      for (const ic of this._materializationInterceptors) {
        try {
          const updated = await ic.initialized?.(ev, instance);
          if (updated !== undefined) instance = updated;
        } catch (e) {
          logInternalError('DatabaseProvider.notifyEntityMaterialized.interceptor', e);
        }
      }
      return instance as T;
    }
    return entity;
  }

  /** Begin a transaction. */
  public async beginTransaction(): Promise<void> {
    await this.notifyTransactionStarting();
    await this.doBeginTransaction();
    await this.notifyTransactionStarted();
  }

  /** Provider-specific begin-transaction logic. */
  protected abstract doBeginTransaction(): Promise<void>;

  /** Commit the current transaction. */
  public async commitTransaction(): Promise<void> {
    await this.notifyTransactionCommitting();
    await this.doCommitTransaction();
    await this.notifyTransactionCommitted();
  }

  /** Provider-specific commit logic. */
  protected abstract doCommitTransaction(): Promise<void>;

  /** Roll back the current transaction. */
  public async rollbackTransaction(): Promise<void> {
    await this.notifyTransactionRollingBack();
    await this.doRollbackTransaction();
    await this.notifyTransactionRolledBack();
  }

  /** Provider-specific rollback logic. */
  protected abstract doRollbackTransaction(): Promise<void>;

  /**
   * Create a named savepoint within the current transaction.
   * Default implementation uses ANSI SQL syntax (`SAVEPOINT name`).
   * Providers that use different syntax (e.g. MSSQL) must override.
   */
  public async createSavepoint(name: string): Promise<void> {
    await this.executeNonQuery(`SAVEPOINT ${name}`);
  }

  /**
   * Roll back to a named savepoint, undoing work done after it was created.
   * Default implementation uses ANSI SQL syntax (`ROLLBACK TO SAVEPOINT name`).
   */
  public async rollbackToSavepoint(name: string): Promise<void> {
    await this.executeNonQuery(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  /**
   * Release (destroy) a named savepoint.
   * Default implementation uses ANSI SQL syntax (`RELEASE SAVEPOINT name`).
   * Providers that do not support RELEASE (e.g. MSSQL) must override as a no-op.
   */
  public async releaseSavepoint(name: string): Promise<void> {
    await this.executeNonQuery(`RELEASE SAVEPOINT ${name}`);
  }

  /**
   * Public facade over the protected `isTransientError` classifier.
   * Used by ExecutionStrategy to check whether an error is worth retrying.
   */
  public checkTransientError(error: unknown): boolean {
    return this.isTransientError(error);
  }

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

  // ── Connection notification helpers ─────────────────────────────────────

  private async notifyConnectionOpening(): Promise<void> {
    if (this._connectionInterceptors.length === 0) return;
    const ev: ConnectionEventData = {};
    for (const ic of this._connectionInterceptors) {
      try {
        await ic.connectionOpening?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyConnectionOpening', e);
      }
    }
  }

  private async notifyConnectionOpened(): Promise<void> {
    if (this._connectionInterceptors.length === 0) return;
    const ev: ConnectionEventData = {};
    for (const ic of this._connectionInterceptors) {
      try {
        await ic.connectionOpened?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyConnectionOpened', e);
      }
    }
  }

  private async notifyConnectionClosing(): Promise<void> {
    if (this._connectionInterceptors.length === 0) return;
    const ev: ConnectionEventData = {};
    for (const ic of this._connectionInterceptors) {
      try {
        await ic.connectionClosing?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyConnectionClosing', e);
      }
    }
  }

  private async notifyConnectionClosed(): Promise<void> {
    if (this._connectionInterceptors.length === 0) return;
    const ev: ConnectionEventData = {};
    for (const ic of this._connectionInterceptors) {
      try {
        await ic.connectionClosed?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyConnectionClosed', e);
      }
    }
  }

  // ── Transaction notification helpers ────────────────────────────────────

  private async notifyTransactionStarting(): Promise<void> {
    if (this._transactionInterceptors.length === 0) return;
    const ev: TransactionEventData = { traceId: this.currentTraceId };
    for (const ic of this._transactionInterceptors) {
      try {
        await ic.transactionStarting?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyTransactionStarting', e);
      }
    }
  }

  private async notifyTransactionStarted(): Promise<void> {
    if (this._transactionInterceptors.length === 0) return;
    const ev: TransactionEventData = { traceId: this.currentTraceId };
    for (const ic of this._transactionInterceptors) {
      try {
        await ic.transactionStarted?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyTransactionStarted', e);
      }
    }
  }

  private async notifyTransactionCommitting(): Promise<void> {
    if (this._transactionInterceptors.length === 0) return;
    const ev: TransactionEventData = { traceId: this.currentTraceId };
    for (const ic of this._transactionInterceptors) {
      try {
        await ic.transactionCommitting?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyTransactionCommitting', e);
      }
    }
  }

  private async notifyTransactionCommitted(): Promise<void> {
    if (this._transactionInterceptors.length === 0) return;
    const ev: TransactionEventData = { traceId: this.currentTraceId };
    for (const ic of this._transactionInterceptors) {
      try {
        await ic.transactionCommitted?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyTransactionCommitted', e);
      }
    }
  }

  private async notifyTransactionRollingBack(): Promise<void> {
    if (this._transactionInterceptors.length === 0) return;
    const ev: TransactionEventData = { traceId: this.currentTraceId };
    for (const ic of this._transactionInterceptors) {
      try {
        await ic.transactionRollingBack?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyTransactionRollingBack', e);
      }
    }
  }

  private async notifyTransactionRolledBack(): Promise<void> {
    if (this._transactionInterceptors.length === 0) return;
    const ev: TransactionEventData = { traceId: this.currentTraceId };
    for (const ic of this._transactionInterceptors) {
      try {
        await ic.transactionRolledBack?.(ev);
      } catch (e) {
        logInternalError('DatabaseProvider.notifyTransactionRolledBack', e);
      }
    }
  }
}
