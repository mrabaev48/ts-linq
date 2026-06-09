import type {
  CircuitState,
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  EntityCtorRef,
  EntityMetadata,
  JunctionQuerySpec,
  OrmMiddleware,
  RetryPolicy,
  SoftDeleteOptions,
  SqlDialect,
  SqlLogger,
  SqlParameter
} from '@ts-linq/types';
import { EntityNotFoundError, InvalidIdentifierError, OperationAbortedError } from '@ts-linq/types';

/**
 * Whitelist for SQL identifiers passed through {@link DatabaseProvider.queryJunction}.
 * A junction identifier must be a plain SQL identifier (letter/underscore start,
 * then letters/digits/underscores). Anything else fails closed before quoting.
 */
const JUNCTION_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

import { type QueryAnalysisContext, QueryAnalyzer } from './analysis/QueryAnalyzer';
import { BatchTransactionRunner } from './batch/BatchTransactionRunner';
import { QueryExecutionPipeline } from './execution/QueryExecutionPipeline';
import { HealthMonitor } from './Health/HealthMonitor';
import type { IDbCommandInterceptor } from './interceptors/IDbCommandInterceptor';
import type { IDbConnectionInterceptor } from './interceptors/IDbConnectionInterceptor';
import type { IDbTransactionInterceptor } from './interceptors/IDbTransactionInterceptor';
import type { IMaterializationInterceptor } from './interceptors/IMaterializationInterceptor';
import { InterceptorDispatcher } from './interceptors/InterceptorDispatcher';
import { CompositeSqlLogger } from './logging/CompositeSqlLogger';
import { MiddlewareDispatcher } from './middleware/MiddlewareDispatcher';
import { ProviderConfig } from './ProviderConfig';
import { ResilienceManager } from './Resilience/ResilienceManager';
import { AnsiSavepointStrategy, type SavepointStrategy } from './strategies/SavepointStrategy';
import { type SequenceStrategy, UnsupportedSequenceStrategy } from './strategies/SequenceStrategy';
import type {
  CircuitBreakerOptions,
  IDatabaseProvider,
  QueryPerformanceAnalysisOptions
} from './types';

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
  /** Template-method orchestration for query execution (resilience + logging + hooks + analysis). */
  private readonly pipeline: QueryExecutionPipeline;

  /** Query-performance analysis policy (sampling / rate-limit / EXPLAIN). */
  private readonly analyzer = new QueryAnalyzer();

  /** Mediator for EF-style interceptor fan-out (connection/transaction/command/materialization). */
  private readonly interceptors = new InterceptorDispatcher();

  /** Dialect savepoint SQL strategy (ANSI by default). */
  private readonly savepointStrategy: SavepointStrategy;
  /** Dialect sequence strategy (unsupported by default). */
  private readonly sequenceStrategy: SequenceStrategy;

  /** Observer fan-out for the OrmMiddleware chain. */
  private readonly mw = new MiddlewareDispatcher(() => this.middlewares);
  /** Runs multi-entity write batches inside a single transaction. */
  private readonly batchRunner = new BatchTransactionRunner(this);

  /**
   * Create a provider from a {@link ProviderConfig} (preferred).
   * @param config Parameter Object carrying connection + cross-cutting options.
   */
  constructor(config: ProviderConfig);
  /**
   * @deprecated Pass a {@link ProviderConfig} instead. The positional-argument
   * form is retained for backward compatibility and will be removed in a future
   * major release. It cannot set `providerName` up front, so resilience/health
   * telemetry is labelled `'unknown'` until a subclass assigns `providerName`.
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
  );
  constructor(
    configOrConnectionString: ProviderConfig | string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy,
    poolOptions?: ConnectionPoolOptions,
    healthCheck?: ConnectionHealthCheckOptions,
    circuitOptions?: CircuitBreakerOptions
  ) {
    const config =
      configOrConnectionString instanceof ProviderConfig
        ? configOrConnectionString
        : new ProviderConfig({
            providerName: 'unknown',
            connectionString: configOrConnectionString,
            logger,
            middlewares,
            softDelete,
            retryPolicy,
            poolOptions,
            healthCheck,
            circuitOptions
          });

    this.connectionString = config.connectionString;
    this.logger = config.logger;
    this.middlewares = config.middlewares;
    this.softDelete = config.softDelete;
    this.retryPolicy = config.retryPolicy;
    this.poolOptions = config.poolOptions;
    this.healthCheck = config.healthCheck;
    this.circuitOptions = config.circuitOptions;
    this.providerName = config.providerName;
    this.analyzer.configure(config.analysis);
    this.savepointStrategy = config.savepointStrategy ?? new AnsiSavepointStrategy();
    this.sequenceStrategy = config.sequenceStrategy ?? new UnsupportedSequenceStrategy();

    // providerName is now the real value (not 'unknown') for the ProviderConfig
    // path, so resilience/health telemetry is labelled correctly from the start.
    this.resilienceManager = new ResilienceManager(
      config.logger,
      this.providerName,
      config.circuitOptions,
      config.retryPolicy,
      (e) => this.isTransientError(e)
    );

    this.healthMonitor = new HealthMonitor(
      config.logger,
      this.providerName,
      config.healthCheck,
      this.resilienceManager
    );

    this.pipeline = new QueryExecutionPipeline(this.resilienceManager);
  }

  /** Connect to the database. */
  public async connect(): Promise<void> {
    await this.interceptors.connectionOpening();
    await this.doConnect();
    await this.interceptors.connectionOpened();
  }

  /** Provider-specific connection logic. */
  protected abstract doConnect(): Promise<void>;

  /** Disconnect from the database and release resources. */
  public async disconnect(): Promise<void> {
    await this.interceptors.connectionClosing();
    await this.doDisconnect();
    await this.interceptors.connectionClosed();
  }

  /** Provider-specific disconnection logic. */
  protected abstract doDisconnect(): Promise<void>;
  /** Create a table for the provided entity metadata if it does not exist. */
  public abstract createTable(entityMetadata: EntityMetadata): Promise<void>;
  /** Return SQL dialect used by this provider (Strategy per provider). */
  public abstract getDialect(): SqlDialect;
  /** Insert an entity instance into its table and return the inserted entity. */
  public abstract insert<T extends object>(entity: T, entityClass: EntityCtorRef): Promise<T>;
  /** Update an existing entity row and return the updated entity. */
  public abstract update<T extends object>(
    entity: T,
    entityClass: EntityCtorRef,
    originalValues?: object
  ): Promise<T>;
  /** Delete an entity row. */
  public abstract delete<T extends object>(
    entity: T,
    entityClass: EntityCtorRef,
    originalValues?: object
  ): Promise<void>;
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
  public async insertMany<T extends object>(
    entities: T[],
    entityClass: EntityCtorRef
  ): Promise<T[]> {
    return this.batchRunner.runAll(entities, async (entity) => this.insert(entity, entityClass));
  }

  /** Update many entities in a single transaction (default implementation). */
  public async updateMany<T extends object>(
    entities: T[],
    entityClass: EntityCtorRef
  ): Promise<T[]> {
    return this.batchRunner.runAll(entities, async (entity) => this.update(entity, entityClass));
  }

  /**
   * Upsert single entity: update first, falling back to insert only when the
   * update reports the row is absent.
   *
   * The fallback is gated on the typed {@link EntityNotFoundError} signal (an
   * update that affected zero rows). Any other failure — deadlock, optimistic
   * concurrency conflict, validation, connection error — propagates instead of
   * being misread as "row absent", which would otherwise spuriously insert a
   * duplicate.
   */
  public async upsert<T extends object>(entity: T, entityClass: EntityCtorRef): Promise<T> {
    try {
      return await this.update(entity, entityClass);
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        return await this.insert(entity, entityClass);
      }
      throw e;
    }
  }

  /** Upsert many entities within a transaction. */
  public async upsertMany<T extends object>(
    entities: T[],
    entityClass: EntityCtorRef
  ): Promise<T[]> {
    return this.batchRunner.runAll(entities, async (entity) => this.upsert(entity, entityClass));
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
   * Dialect-aware, parameterized junction (many-to-many) read.
   *
   * Capability port consumed by the relationship loader so that `@ts-linq/core`
   * never builds raw SQL: every identifier is validated against
   * {@link JUNCTION_IDENTIFIER_PATTERN} and quoted via the dialect's
   * `quoteIdentifier`, while all filter values are bound as parameters. An
   * invalid identifier throws {@link InvalidIdentifierError} (fails closed)
   * rather than being interpolated. Providers inherit this safe default and
   * only override it if a dialect needs a different junction strategy.
   */
  public async queryJunction(spec: JunctionQuerySpec): Promise<Record<string, unknown>[]> {
    if (spec.whereValues.length === 0) return [];

    const dialect = this.getDialect();
    const quote = (identifier: string): string => {
      if (!JUNCTION_IDENTIFIER_PATTERN.test(identifier)) {
        throw new InvalidIdentifierError(
          `Invalid SQL identifier in junction query: ${JSON.stringify(identifier)}`,
          { details: { identifier } }
        );
      }
      return dialect.quoteIdentifier(identifier);
    };

    const columns = spec.selectColumns.map(quote).join(', ');
    const table = quote(spec.table);
    const whereColumn = quote(spec.whereColumn);
    const placeholders = spec.whereValues.map(() => '?').join(', ');
    const sql = `SELECT ${columns} FROM ${table} WHERE ${whereColumn} IN (${placeholders})`;

    return this.executeQuery<Record<string, unknown>>(sql, spec.whereValues);
  }

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
      if (signal?.aborted) throw new OperationAbortedError('Operation aborted');
      const chunkLimit = Math.min(CHUNK_SIZE, remaining === Infinity ? CHUNK_SIZE : remaining);
      const chunkSql = this.buildChunkSql(baseSql, chunkLimit, offset);
      if (!this.isConnected) await this.connect();
      const rows = await this.doExecuteQuery<Record<string, unknown>>(chunkSql, params);
      if (rows.length === 0) break;
      for (const row of rows) {
        if (signal?.aborted) throw new OperationAbortedError('Operation aborted');
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
   * Retry wrapper delegating the orchestration sequence to the
   * {@link QueryExecutionPipeline} while supplying the provider's volatile state
   * and lifecycle hooks.
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    sql: string,
    params: readonly SqlParameter[]
  ): Promise<T> {
    return this.pipeline.execute(fn, {
      sql,
      params,
      traceId: this.currentTraceId,
      inTransaction: this.inTransaction,
      providerName: this.providerName,
      logger: this.logger,
      onStart: (startedAt) => {
        this.lastExecuteStartedAt = startedAt;
      },
      beforeExecute: async () => this.beforeExecute(sql, params),
      afterExecute: async (result) => this.afterExecute(sql, params, result),
      analyze: async (durationMs, error) =>
        this.analyzer.analyze({ sql, params, durationMs, error }, this.analysisContext())
    });
  }

  /** Configure query performance analysis at runtime. */
  public configureQueryAnalysis(options?: QueryPerformanceAnalysisOptions): void {
    this.analyzer.configure(options);
  }

  /** Snapshot the volatile state the analyzer needs for the current query. */
  private analysisContext(): QueryAnalysisContext {
    return {
      inTransaction: this.inTransaction,
      providerName: this.providerName,
      logger: this.logger,
      middlewares: this.middlewares,
      getExplainPlan: async (sql, params) => this.getExplainPlan(sql, params)
    };
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
    this.interceptors.configure(opts);
  }

  /** Provider hook: obtain an EXPLAIN plan for a given SQL if supported. */
  protected async getExplainPlan(
    _sql: string,
    _params: readonly SqlParameter[]
  ): Promise<unknown | undefined> {
    // Default: not supported in base class
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
    this.logger = this.logger ? new CompositeSqlLogger(this.logger, extra) : extra;
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
    await this.mw.beforeExecute(sql, params, this.currentTraceId);
    await this.interceptors.commandExecuting(sql, params, this.currentTraceId);
  }

  /** Called after each execute; invokes middlewares and command interceptors. */
  protected async afterExecute(
    sql: string,
    params: readonly SqlParameter[],
    result: unknown
  ): Promise<void> {
    const durationMs = this.lastExecuteStartedAt ? Date.now() - this.lastExecuteStartedAt : 0;
    await this.mw.afterExecute(sql, params, result, durationMs, this.currentTraceId);
    await this.interceptors.commandExecuted(sql, params, this.currentTraceId, durationMs, result);
  }

  /**
   * Notify middleware and materialization interceptors that an entity was materialized.
   * Returns the (potentially modified) entity instance.
   */
  protected async notifyEntityMaterialized<T extends object>(
    entity: T,
    metadata?: EntityMetadata
  ): Promise<T> {
    await this.mw.entityMaterialized(entity, metadata);
    return this.interceptors.entityMaterialized(entity);
  }

  /** Begin a transaction. */
  public async beginTransaction(): Promise<void> {
    await this.interceptors.transactionStarting(this.currentTraceId);
    await this.doBeginTransaction();
    await this.interceptors.transactionStarted(this.currentTraceId);
  }

  /** Provider-specific begin-transaction logic. */
  protected abstract doBeginTransaction(): Promise<void>;

  /** Commit the current transaction. */
  public async commitTransaction(): Promise<void> {
    await this.interceptors.transactionCommitting(this.currentTraceId);
    await this.doCommitTransaction();
    await this.interceptors.transactionCommitted(this.currentTraceId);
  }

  /** Provider-specific commit logic. */
  protected abstract doCommitTransaction(): Promise<void>;

  /** Roll back the current transaction. */
  public async rollbackTransaction(): Promise<void> {
    await this.interceptors.transactionRollingBack(this.currentTraceId);
    await this.doRollbackTransaction();
    await this.interceptors.transactionRolledBack(this.currentTraceId);
  }

  /** Provider-specific rollback logic. */
  protected abstract doRollbackTransaction(): Promise<void>;

  /**
   * Reserves the next Hi-Lo block from a database sequence and returns the high-water mark.
   * For native sequences (PG, MSSQL) this executes NEXTVAL / NEXT VALUE FOR.
   * For MySQL this updates the emulation counter table.
   *
   * The returned value is the *maximum* ID of the reserved block.
   * The block covers [returnedValue - blockSize + 1, returnedValue].
   *
   * Override in dialect providers that support sequences. The base implementation throws.
   */
  public async nextSequenceValue(
    sequenceName: string,
    schema: string | undefined,
    blockSize: number
  ): Promise<number> {
    return this.sequenceStrategy.nextValue(this, sequenceName, schema, blockSize);
  }

  /**
   * Create a named savepoint within the current transaction.
   * The SQL is produced by the injected {@link SavepointStrategy} (ANSI by
   * default); a `null` statement is treated as a no-op.
   */
  public async createSavepoint(name: string): Promise<void> {
    const sql = this.savepointStrategy.createSql(name);
    if (sql !== null) await this.runSavepointStatement(sql);
  }

  /** Roll back to a named savepoint (SQL from the savepoint strategy). */
  public async rollbackToSavepoint(name: string): Promise<void> {
    const sql = this.savepointStrategy.rollbackToSql(name);
    if (sql !== null) await this.runSavepointStatement(sql);
  }

  /**
   * Release (destroy) a named savepoint (SQL from the savepoint strategy).
   * Dialects without a RELEASE concept return `null` (no-op).
   */
  public async releaseSavepoint(name: string): Promise<void> {
    const sql = this.savepointStrategy.releaseSql(name);
    if (sql !== null) await this.runSavepointStatement(sql);
  }

  /**
   * Execute a transaction-control (savepoint) statement. Defaults to the normal
   * non-query path; providers whose driver cannot run these through prepared
   * statements (e.g. mysql2's `execute`) override this to route differently.
   */
  protected async runSavepointStatement(sql: string): Promise<void> {
    await this.executeNonQuery(sql);
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
}
