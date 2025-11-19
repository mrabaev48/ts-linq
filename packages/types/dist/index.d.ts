export type SqlParameter = string | number | boolean | Date | Uint8Array | null;
export interface OrderByClause {
    column: string;
    direction: 'ASC' | 'DESC';
}
export interface WhereClause {
    condition: string;
    parameters: readonly SqlParameter[];
}
export interface JoinClause {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    table: string;
    on: string;
    alias?: string;
}
export interface GroupByClause {
    columns: string[];
    having?: WhereClause;
}
export interface QueryOptions {
    select?: string[];
    selectParams?: SqlParameter[];
    where?: WhereClause | WhereClause[];
    orderBy?: OrderByClause[];
    joins?: JoinClause[];
    groupBy?: string[] | GroupByClause;
    having?: WhereClause;
    limit?: number;
    offset?: number;
    distinct?: boolean;
    from?: string;
    cte?: {
        name: string;
        sql: string;
    };
}
export interface ColumnOptions {
    name?: string;
    type?: string;
    nullable?: boolean;
    unique?: boolean;
    default?: unknown;
    primaryKey?: boolean;
}
export interface RelationshipOptions {
    targetEntity: () => Function;
    inverseSide?: string;
    cascade?: boolean;
}
export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type CircuitState = 'closed' | 'open' | 'half-open';
export interface QueryStartInfo {
    sql: string;
    params: readonly SqlParameter[];
    traceId?: string;
    provider?: string;
}
export interface QueryEndInfo {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    traceId?: string;
    rows?: number;
    error?: Error;
    provider?: string;
}
export interface RetryInfo {
    sql: string;
    params: readonly SqlParameter[];
    attempt: number;
    traceId?: string;
    provider?: string;
}
export interface TransactionInfo {
    traceId?: string;
    provider?: string;
}
export interface CacheInfo {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
    ttl?: boolean;
}
export interface ConnectionHealthInfo {
    healthy: boolean;
    latencyMs?: number;
    provider?: string;
    status?: ConnectionHealthStatus;
}
export interface CircuitEventInfo {
    state: CircuitState;
    provider?: string;
    failures?: number;
    reason?: string;
    halfOpenInFlight?: number;
}
export interface FallbackInfo {
    provider?: string;
    fallback: string;
    attempted: boolean;
    succeeded?: boolean;
    error?: Error;
    throttled?: boolean;
    isStale?: boolean;
    asOf?: number;
    source?: string;
}
export interface HedgedWinInfo {
    provider?: string;
    operation: string;
    fallback: string;
}
export interface QueryAnalysisInfo {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    provider?: string;
    slow?: boolean;
    explainPlan?: unknown;
    recommendations?: ReadonlyArray<string>;
}
export interface SqlLogger extends Logger {
    cache?(info: CacheInfo): void;
    queryStart?(info: QueryStartInfo): void;
    queryEnd?(info: QueryEndInfo): void;
    retry?(info: RetryInfo): void;
    transactionStart?(info: TransactionInfo): void;
    transactionEnd?(info: TransactionInfo): void;
    connectionHealth?(info: ConnectionHealthInfo): void;
    circuit?(info: CircuitEventInfo): void;
    fallback?(info: FallbackInfo): void;
    hedgedWin?(info: HedgedWinInfo): void;
    analysis?(info: QueryAnalysisInfo): void;
}
export interface SqlLoggerFactory {
    create(provider: 'sqlite' | 'mysql' | 'postgresql' | 'mssql' | string): SqlLogger | undefined;
}
export interface SqlDialect {
    buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
        query: string;
        parameters: readonly SqlParameter[];
    };
    quoteIdentifier(identifier: string): string;
}
export interface OrmMiddleware {
    beforeExecute?(info: {
        sql: string;
        params: readonly SqlParameter[];
        traceId?: string;
    }): Promise<void> | void;
    afterExecute?(info: {
        sql: string;
        params: readonly SqlParameter[];
        durationMs: number;
        traceId?: string;
        rows?: number;
    }): Promise<void> | void;
    entityMaterialized?<T>(entity: T | {
        entity: object;
        metadata?: any;
    }): void;
}
export interface RetryPolicy {
    shouldRetry(error: unknown, attempt: number, inTransaction?: boolean): boolean;
    getDelayMs?(attempt: number): number;
}
export interface ConnectionPoolOptions {
    min?: number;
    max?: number;
    idleTimeoutMs?: number;
    connectionTimeoutMs?: number;
    acquireTimeoutMs?: number;
}
export interface ConnectionHealthCheckOptions {
    enabled?: boolean;
    intervalMs?: number;
    timeoutMs?: number;
    testQuery?: string;
    minIntervalMs?: number;
    maxIntervalMs?: number;
    degradeAfterFailures?: number;
    unhealthyAfterFailures?: number;
}
export interface SoftDeleteOptions {
    enabled?: boolean;
    column?: string;
    columnName?: string;
    type?: 'boolean' | 'timestamp';
}
export interface BaseProviderConfig {
    logger?: SqlLogger;
    middlewares?: OrmMiddleware[];
    softDelete?: SoftDeleteOptions;
    retryPolicy?: RetryPolicy;
    poolOptions?: ConnectionPoolOptions;
    healthCheck?: ConnectionHealthCheckOptions;
}
export interface SQLiteConfig extends BaseProviderConfig {
    file: string;
    mode?: 'memory' | 'readonly' | 'readwrite';
    busyTimeoutMs?: number;
}
export interface PostgresConfig extends BaseProviderConfig {
    host: string;
    port?: number;
    database: string;
    user: string;
    password?: string;
    ssl?: boolean | object;
    applicationName?: string;
    schema?: string;
    connectionTimeoutMs?: number;
}
export interface MySqlConfig extends BaseProviderConfig {
    host: string;
    port?: number;
    user: string;
    password?: string;
    database: string;
    socketPath?: string;
    charset?: string;
    timezone?: string;
}
export interface MssqlConfig extends BaseProviderConfig {
    server: string;
    port?: number;
    database: string;
    user?: string;
    password?: string;
    domain?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    integratedSecurity?: boolean;
    instanceName?: string;
    connectionTimeout?: number;
    applicationName?: string;
    options?: Record<string, unknown>;
}
export interface GlobalFilter {
    filterName: string;
    entity?: string;
    where?: WhereClause;
    predicate?: (query: QueryOptions) => QueryOptions;
}
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export interface CteDefinition {
    name: string;
    query?: string;
    sql?: string;
    parameters?: SqlParameter[];
}
export interface Result<T, E = Error> {
    success: boolean;
    value?: T;
    error?: E;
}
export declare function ok<T>(value: T): Result<T>;
export declare function err<E = Error>(error: E): Result<never, E>;
export type FallbackOperation = 'select' | 'count' | 'aggregate' | 'insert' | 'update' | 'delete' | 'first' | 'single' | 'any';
export interface FallbackRequest<T = unknown> {
    operation: FallbackOperation;
    entityClass: Function;
    entity?: Function;
    query?: QueryOptions;
    sql?: string;
    params?: readonly SqlParameter[];
}
export interface QueryFallback<T = unknown> {
    label: string;
    canHandle(request: FallbackRequest<T>): boolean;
    execute<T>(request: FallbackRequest<T>): Promise<T[]>;
    fetch<T>(request: FallbackRequest<T>): Promise<T[]>;
    fetchCount?(request: FallbackRequest<T>): Promise<number>;
}
export interface FallbackPolicy {
    allowOps?: FallbackOperation[];
    allowIncludesOnFallback?: 'attempt' | 'skip' | 'error';
    hedged?: {
        sources?: QueryFallback[];
        timeout?: number;
        enabled?: boolean;
        delayMs?: number;
    };
    throttle?: {
        maxConcurrent?: number;
        minIntervalMs?: number;
        jitterRatio?: number;
        maxPerMinute?: number;
    };
}
export interface CountCache {
    get(key: string): number | undefined;
    set(key: string, value: number): void;
    clear(): void;
}
export interface SqlCacheEntry {
    query: string;
    parameters: SqlParameter[];
}
export interface SqlCache {
    get(key: string): SqlCacheEntry | undefined;
    set(key: string, value: SqlCacheEntry): void;
    clear(): void;
    size(): number;
    /** Optional targeted invalidation. Should return number of removed entries. */
    invalidateBy?(matcher: (key: string) => boolean): number;
    /** Optional metrics exposure for monitoring. */
    getMetrics?(): {
        currentSize: number;
        totalRequests?: number;
        hits?: number;
        misses?: number;
        evictions?: number;
        invalidations?: number;
    };
}
export interface PerformanceOptions {
    enableQueryCache?: boolean;
    enableCountCache?: boolean;
    enableEntityCache?: boolean;
    queryTimeout?: number;
    countCache?: CountCache | any;
    countCacheTtlMs?: number;
    sqlCache?: unknown;
    cacheNamespace?: string;
    fallbackPolicy?: FallbackPolicy;
    entityCache?: EntityCacheLike;
    entityCacheSize?: number;
    analysis?: unknown;
}
export declare enum LoadingStrategy {
    Lazy = "lazy",
    Eager = "eager",
    Explicit = "explicit"
}
export interface CacheOptions {
    ttl?: number;
    maxSize?: number;
}
export type ColumnType = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP' | string;
export interface ColumnMetadata {
    propertyName: string;
    columnName: string;
    type: ColumnType;
    nullable?: boolean;
    unique?: boolean;
    primaryKey?: boolean;
    default?: unknown;
    defaultValue?: unknown;
    defaultExpression?: string;
    defaultExpressionDialect?: Record<string, string | undefined>;
    computedExpression?: string;
    length?: number;
    precision?: number;
    scale?: number;
    generated?: boolean;
    isGenerated?: boolean;
    isComputed?: boolean;
    version?: boolean;
    isVersion?: boolean;
}
export interface RelationshipMetadata {
    propertyName: string;
    type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
    targetEntity: string | Function | (() => Function);
    foreignKey?: string;
    inverseSide?: string;
    cascade?: boolean;
    through?: string | object;
}
export interface IndexMetadata {
    name: string;
    columns: string[];
    unique?: boolean;
    where?: string;
    orders?: {
        [column: string]: 'ASC' | 'DESC';
    };
    expressions?: string[];
    collations?: {
        [column: string]: string;
    };
    nulls?: {
        [column: string]: 'FIRST' | 'LAST';
    };
    using?: string;
    concurrently?: boolean;
    withParams?: Record<string, unknown>;
    mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
    include?: string[];
}
export interface ValidationRule {
    propertyName?: string;
    validator?: (value: unknown, entity: unknown) => boolean;
    message?: string;
    predicate?: (value: unknown) => boolean;
    phase?: 'onCreate' | 'onUpdate' | 'always';
    messageKey?: string;
    messageParams?: Record<string, unknown>;
}
export interface EntityMetadata {
    target?: Function;
    className?: string;
    tableName: string;
    columns: ColumnMetadata[];
    relationships: RelationshipMetadata[];
    indexes: IndexMetadata[];
    validationRules?: ValidationRule[];
    validations?: ValidationRule[];
    primaryKeys?: string[];
    primaryKeyColumn?: string;
    schema?: string;
}
export interface EntityCacheLike {
    get<T>(entityClass: Function, id: unknown): T | undefined;
    set<T>(entityClass: Function, id: unknown, entity: T): void;
    remove(entityClass: Function, id: unknown): void;
    clear(): void;
    size?(): number;
}
export interface LoadingDefaults {
    strategy?: LoadingStrategy;
    maxDepth?: number;
    depth?: number;
}
export interface AuditOptions {
    enabled?: boolean;
    createdAtColumn?: string;
    updatedAtColumn?: string;
    createdByColumn?: string;
    updatedByColumn?: string;
    getCurrentUser?: () => string | number | Promise<string | number>;
    clock?: () => Date;
    timeColumns?: {
        createdAt?: string;
        updatedAt?: string;
    };
    userColumns?: {
        createdBy?: string;
        updatedBy?: string;
    };
}
export { DatabaseError, OptimisticConcurrencyError, UniqueConstraintError, ForeignKeyConstraintError, ValidationError } from './errors';
export interface PerformanceOptionsExtended extends PerformanceOptions {
    inClauseChunkSize?: number;
}
export interface SoftDeleteOptionsExtended extends SoftDeleteOptions {
    deletedAtColumn?: string;
}
//# sourceMappingURL=index.d.ts.map