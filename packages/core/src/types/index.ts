import 'reflect-metadata';
import type { SqlCache } from '../query/SqlCache';
import type { CountCache } from '../query/CountCache';
import type { EntityCacheLike } from '../utils/EntityCache';
import type { DatabaseProvider } from '../DatabaseProvider';

/**
 * Core types and metadata contracts used across the ORM.
 */
export enum EntityState {
  Unchanged = 'unchanged',
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted'
}

/**
 * Strategy for loading related entities.
 * - Lazy: relationships are not auto-loaded
 * - Eager: relationships are loaded immediately
 */
export enum LoadingStrategy {
  Lazy = 'lazy',
  Eager = 'eager'
}

/**
 * SQL join types supported by the query builder.
 */
export enum JoinType {
  Inner = 'INNER',
  Left = 'LEFT',
  Right = 'RIGHT',
  Full = 'FULL'
}

/**
 * Internal structure representing a tracked entity and its state.
 */
export interface TrackedEntity {
  entity: object;
  entityClass: Function;
  state: EntityState;
  originalValues?: object;
}

/**
 * Options for constructing a database context.
 */
export interface DbContextOptions {
  /** Database provider instance. */
  provider: DatabaseProvider;
  /** Optional performance tuning options. */
  performance?: PerformanceOptions;
  /** Optional default loading behavior. */
  loading?: LoadingDefaults;
  /** Optional soft delete configuration. */
  softDelete?: SoftDeleteOptions;
  /** Optional audit configuration. */
  audit?: AuditOptions;
  /** Optional global query filters applied to matching entities. */
  globalFilters?: GlobalFilter[];
  /** Optional validation/i18n options. */
  validation?: {
    /** Translate a message key with optional parameters into a localized message. */
    translate?: (key: string, params?: Record<string, unknown>) => string;
  };
}

/** Generic connection pool options (provider-agnostic). */
export interface ConnectionPoolOptions {
  /** Minimum number of pooled connections to keep. */
  min?: number;
  /** Maximum number of pooled connections. */
  max?: number;
  /** Idle connection timeout in milliseconds. */
  idleTimeoutMs?: number;
  /** Timeout for acquiring a connection from the pool in milliseconds. */
  acquireTimeoutMs?: number;
  /** Initial connection timeout in milliseconds (provider specific). */
  connectionTimeoutMs?: number;
}

/** Connection health check scheduler options. */
export interface ConnectionHealthCheckOptions {
  /** Enable periodic health checks (lightweight ping). */
  enabled?: boolean;
  /** Interval between checks, in milliseconds. Default: 60000. */
  intervalMs?: number;
  /** Max allowed time for a single ping before considering unhealthy. */
  timeoutMs?: number;
  /** Optional SQL used for ping; defaults to provider-specific 'SELECT 1'. */
  testQuery?: string;
  /** Optional backoff: min interval when healthy (ms). */
  minIntervalMs?: number;
  /** Optional backoff: max interval when degraded/unhealthy (ms). */
  maxIntervalMs?: number;
  /** Failures to mark as degraded. Default: 3. */
  degradeAfterFailures?: number;
  /** Failures to mark as unhealthy (opens breaker). Default: 6. */
  unhealthyAfterFailures?: number;
}

/** Circuit Breaker finite states. */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit Breaker options.
 * - failureThreshold: consecutive failures to open the circuit
 * - openDurationMs: time to keep circuit open before allowing half-open probes
 * - halfOpenMaxCalls: concurrent probes allowed in half-open state
 * - countTransientOnly: when true, count only transient errors towards failures
 */
export interface CircuitBreakerOptions {
  /** Enable/disable circuit breaker entirely (default: true). */
  enabled?: boolean;
  failureThreshold?: number;
  openDurationMs?: number;
  /** Maximum cap for open duration with backoff (default: 300000 ms). */
  maxOpenDurationMs?: number;
  halfOpenMaxCalls?: number;
  countTransientOnly?: boolean;
}

/**
 * Options for controlling entity loading behavior.
 */
export interface LoadingOptions {
  /** Default strategy: lazy (no automatic includes) or eager (auto include). */
  strategy?: LoadingStrategy;
  /** Property names of relationships to include (validated against metadata). */
  includes?: string[];
  /** Max recursion depth for nested includes (1 by default). */
  depth?: number;
}

/**
 * Column configuration stored in entity metadata.
 */
export type ColumnType =
  | 'TEXT'
  | 'STRING'
  | 'INTEGER'
  | 'NUMBER'
  | 'REAL'
  | 'FLOAT'
  | 'DOUBLE'
  | 'BOOLEAN'
  | 'DATETIME'
  | 'DATE'
  | 'BLOB'
  | 'UUID'
  | 'JSON'
  | 'JSONB';

export interface ColumnMetadata {
  /** Entity property name. */
  propertyName: string;
  /** Database column name. */
  columnName: string;
  /** Logical column type. */
  type: ColumnType | string;
  /** Whether NULL is allowed. */
  nullable: boolean;
  /** Default value applied on INSERT when undefined. */
  defaultValue?: unknown;
  /** Raw SQL default expression (e.g., CURRENT_TIMESTAMP). Takes precedence over defaultValue. */
  defaultExpression?: string;
  /** Dialect-specific default expressions mapping; takes precedence over defaultExpression when rendering for that dialect. */
  defaultExpressionDialect?: Partial<
    Record<'sqlite' | 'postgresql' | 'mysql' | 'mssql' | string, string>
  >;
  /** Max length for text columns. */
  length?: number;
  /** Numeric precision for decimals. */
  precision?: number;
  /** Numeric scale for decimals. */
  scale?: number;
  /** True when value is generated by the DB (e.g., AUTOINCREMENT). */
  isGenerated?: boolean;
  /** True when column is an optimistic concurrency token (version). */
  isVersion?: boolean;
  /** Whether this column is intended to be a branded identifier. */
  isBranded?: boolean;
  /** Optional brand marker (usually entity name) for diagnostics/docs. */
  brand?: string;
  /** Whether this column is a computed/generated column (expression-based). */
  isComputed?: boolean;
  /** Provider-agnostic SQL expression for computed value (dialect adapts as needed). */
  computedExpression?: string;
  /** Storage hint for computed column: VIRTUAL/STORED (MySQL/SQLite) or PERSISTED (MSSQL). */
  computedStorage?: 'VIRTUAL' | 'STORED' | 'PERSISTED';
  /** Read-only column flag for DX: values are not persisted by ORM. Implied by isComputed. */
  isReadOnly?: boolean;
}

/** Static global filter applied to all queries of a specific entity. */
export interface GlobalFilter {
  /** Target entity constructor. */
  entity: Function;
  /** WHERE clause to prepend for this entity. */
  where: { condition: string; parameters: readonly SqlParameter[] };
}

/** Soft delete feature options. */
export interface SoftDeleteOptions {
  /** Enable soft delete behavior globally. */
  enabled?: boolean;
  /** Boolean column name used to mark deletion (default: 'isDeleted'). */
  column?: string;
  /** Optional timestamp column name when the entity was soft-deleted (default: 'deletedAt'). */
  deletedAtColumn?: string;
}

/** Audit stamping feature options. */
export interface AuditOptions {
  /** Enable audit stamping globally. */
  enabled?: boolean;
  /** Column names used for timestamp fields. */
  timeColumns?: { createdAt?: string; updatedAt?: string };
  /** Column names used for user id fields. */
  userColumns?: { createdBy?: string; updatedBy?: string };
  /** Function to resolve current user id for stamping. */
  getCurrentUserId?: () => string | number | null | undefined;
  /** Function to resolve current time (default: new Date()). */
  clock?: () => Date;
}

/**
 * Relationship configuration stored in entity metadata.
 */
export interface RelationshipMetadata {
  /** Navigation property name on the source entity. */
  propertyName: string;
  /** Relationship cardinality. */
  type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
  /** Target entity constructor or lazy thunk returning it. */
  targetEntity: Function | (() => Function);
  /** Foreign key column name on the dependent side (optional). */
  foreignKey?: string;
  /** Inverse navigation property name on the target entity (optional). */
  inverseSide?: string;
  /** Cascade operations (insert/update/delete) when true. */
  cascade?: boolean;
  /** Many-to-many join configuration (junction table and key columns). */
  through?: {
    /** Junction table name */
    table: string;
    /** FK column in junction table pointing to source entity (e.g., userId) */
    sourceFk?: string;
    /** FK column in junction table pointing to target entity (e.g., roleId) */
    targetFk?: string;
    /** Explicit source PK column name (fallback to metadata primary key) */
    sourcePk?: string;
    /** Explicit target PK column name (fallback to metadata primary key) */
    targetPk?: string;
  };
}

/**
 * Index definition for an entity.
 */
export interface IndexMetadata {
  /** Index identifier (unique within table). */
  name: string;
  /** Ordered list of column names participating in the index. */
  columns: string[];
  /** Whether the index enforces uniqueness. */
  unique: boolean;
  /** Optional WHERE predicate for partial/filtered indexes. */
  where?: string;
  /** Optional per-column ordering (ASC/DESC). */
  orders?: { [column: string]: 'ASC' | 'DESC' };
  /** Optional raw SQL expressions to include as index key parts (dialect renders as-is). */
  expressions?: string[];
  /** Optional per-column collation (by name). */
  collations?: { [column: string]: string };
  /** Optional per-column NULLS ordering (PG): FIRST|LAST. */
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
  /** Postgres: index method (btree/hash/gin/gist) */
  using?: 'btree' | 'hash' | 'gin' | 'gist';
  /** Postgres: build concurrently */
  concurrently?: boolean;
  /** Postgres: storage parameters (WITH (...)) */
  withParams?: Record<string, string | number | boolean>;
  /** MySQL 8.0+: index visibility */
  mysqlVisibility?: 'VISIBLE' | 'INVISIBLE';
  /** MSSQL: included non-key columns */
  include?: string[];
}

/**
 * Full metadata description for an entity type.
 */
export interface EntityMetadata {
  /** Entity constructor function. */
  target: Function;
  /** Physical table name. */
  tableName: string;
  /** All mapped columns. */
  columns: ColumnMetadata[];
  /** Property names forming the primary key (composite supported). */
  primaryKeys: string[];
  /** Declared relationships. */
  relationships: RelationshipMetadata[];
  /** Index definitions. */
  indexes: IndexMetadata[];
  /** Conditional validation rules. */
  validations?: ValidationRule[];
}

/**
 * Standardized structure for returning query results with optional paging info.
 */
export interface QueryResult<T> {
  /** Result rows. */
  data: T[];
  /** Optional total for paged queries. */
  total?: number;
  /** 1-based page number. */
  page?: number;
  /** Page size. */
  pageSize?: number;
}

/**
 * Generic key-value map for aggregate query results.
 */
export interface AggregateResult {
  [key: string]: string | number | boolean | null | Date | Uint8Array | undefined;
}

/**
 * Join clause used during SQL generation.
 */
export interface JoinClause {
  /** SQL join type keyword. */
  type: JoinType;
  /** Joined table name (or subquery alias). */
  table: string;
  /** ON clause (already escaped/mapped as needed). */
  on: string;
  /** Optional table alias. */
  alias?: string;
}

/**
 * WHERE clause fragment with parameter list.
 */
export interface WhereClause {
  /** SQL condition fragment with placeholders (e.g., "price > ?"). */
  condition: string;
  /** Positional parameter values to bind. */
  parameters: readonly SqlParameter[];
}

/** Supported SQL parameter types passed to providers. */
export type SqlParameter = string | number | boolean | Date | Uint8Array | null;

/**
 * ORDER BY clause element.
 */
export interface OrderByClause {
  /** Column/expression to order by. */
  column: string;
  /** ASC or DESC. */
  direction: 'ASC' | 'DESC';
}

/**
 * GROUP BY configuration and optional HAVING condition.
 */
export interface GroupByClause {
  /** Column list used for grouping. */
  columns: string[];
  /** Optional HAVING predicate. */
  having?: WhereClause;
}

/** Expression node that can render SQL with parameters. */
export interface SqlExpression {
  /** String representation of the expression (dialect-agnostic or default). */
  toString(): string;
}

/** Common Table Expression (CTE) definition. */
export interface CteDefinition {
  name: string;
  sql: string;
}

/** Conditional validation rule stored in metadata. */
export interface ValidationRule {
  /** Property to which rule applies (for diagnostics). */
  propertyName: string;
  /** Predicate evaluated on entity; must return true for valid state. */
  predicate: (entity: unknown) => boolean;
  /** Optional error message. */
  message?: string;
  /** Optional message key used for i18n. */
  messageKey?: string;
  /** Optional message parameters used with messageKey. */
  messageParams?: Record<string, unknown>;
  /** Optional execution phase: onCreate (Added), onUpdate (Modified), or always. */
  phase?: 'onCreate' | 'onUpdate' | 'always';
}

/**
 * Accumulated options that define a SQL query to be generated.
 */
export interface QueryOptions {
  /** Selected columns or expressions (defaults to *). */
  select?: Array<string | SqlExpression>;
  /** Parameters produced by select expressions (order-sensitive). */
  selectParams?: SqlParameter[];
  /** WHERE predicates with parameters. */
  where?: WhereClause[];
  /** ORDER BY items. */
  orderBy?: OrderByClause[];
  /** GROUP BY clause with optional HAVING. */
  groupBy?: GroupByClause;
  /** JOIN clauses (reserved for future use). */
  joins?: JoinClause[];
  /** LIMIT value. */
  limit?: number;
  /** OFFSET value. */
  offset?: number;
  /** DISTINCT selector. */
  distinct?: boolean;
  /** FROM override (table, view or CTE name). */
  from?: string;
  /** Optional CTE definition to prepend. */
  cte?: CteDefinition;
}

/**
 * Performance-related options to tune caching and counts.
 */
export interface PerformanceOptions {
  /** Enable level-2 entity cache (by primary key). Default: false. */
  enableEntityCache?: boolean;
  /** Maximum L2 cache size. Default: 10000. */
  entityCacheSize?: number;
  /** Optional external L2 entity cache adapter. Overrides in-memory cache when provided. */
  entityCache?: EntityCacheLike;
  /** Enable count() result caching for pagination. Default: false. */
  enableCountCache?: boolean;
  /** TTL for count() cache entries in milliseconds. Default: 0 (no TTL, disabled unless enableCountCache). */
  countCacheTtlMs?: number;
  /** Optional external SQL generation cache implementation. */
  sqlCache?: SqlCache;
  /** Optional external count cache implementation. */
  countCache?: CountCache;
  /** Optional namespace included in cache keys for isolation (tenant/schema/etc). */
  cacheNamespace?: string;
  /** Max size for an IN() chunk during batch optimizations (default 1000). */
  inClauseChunkSize?: number;
  /** Optional fallback policy for graceful degradation. */
  fallbackPolicy?: FallbackPolicy;
  /** Optional query performance analysis configuration. */
  analysis?: QueryPerformanceAnalysisOptions;
}

/**
 * Default loading settings configured at the context level.
 */
export interface LoadingDefaults {
  /** Default loading strategy for find/findAll and include population. */
  strategy?: LoadingStrategy;
  /** Default recursion depth for relationship loading (default: 1). */
  depth?: number;
}

/**
 * Minimal SQL logger interface for centralized diagnostics.
 */
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
  /** True when hit was served from TTL-bound entry (e.g., count cache with TTL). */
  ttl?: boolean;
}

export interface ConnectionHealthInfo {
  healthy: boolean;
  latencyMs?: number;
  provider?: string;
  status?: ConnectionHealthStatus;
}

export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface SqlLogger {
  /** Called right before a query is executed. */
  queryStart?(info: QueryStartInfo): void;
  /** Called right after a query is executed. */
  queryEnd?(info: QueryEndInfo): void;
  /** Called when a retry attempt is scheduled/executed for a transient error. */
  retry?(info: RetryInfo): void;
  /** Called when a transaction begins (for gauges/metrics). */
  transactionStart?(info: TransactionInfo): void;
  /** Called when a transaction ends (commit or rollback). */
  transactionEnd?(info: TransactionInfo): void;
  /** Cache metric hook: records hits/misses for specific caches. */
  cache?(info: CacheInfo): void;
  /** Optional hook for connection health reports. */
  connectionHealth?(info: ConnectionHealthInfo): void;
  /** Optional hook for circuit breaker state transitions. */
  circuit?(info: CircuitEventInfo): void;
  /** Optional hook for graceful degradation fallback attempts/results. */
  fallback?(info: FallbackInfo): void;
  /** Optional hook for hedged-request wins (fallback beat primary). */
  hedgedWin?(info: { provider?: string; operation: string; fallback: string }): void;
  /** Optional hook for query performance analysis events. */
  analysis?(info: QueryAnalysisInfo): void;
}

/** Factory for creating SqlLogger per provider to satisfy DIP. */
export interface SqlLoggerFactory {
  create(provider: 'sqlite' | 'mysql' | 'postgresql' | 'mssql' | string): SqlLogger | undefined;
}

/** Retry policy contract for controlling retries/backoff on transient errors. */
export interface RetryPolicy {
  /** Decide whether to retry given error at the attempt (1-based). */
  shouldRetry(error: unknown, attempt: number, inTransaction: boolean): boolean;
  /** Calculate delay before next retry attempt in milliseconds. */
  getDelayMs(attempt: number): number;
  /** Extended decision hook with richer context (optional, non-breaking). */
  shouldRetryEx?(info: RetryDecisionInfo): boolean;
}

/** Options controlling automatic query performance analysis. */
export interface QueryPerformanceAnalysisOptions {
  /** Enable analysis; default: false. */
  enabled?: boolean;
  /** Consider a query slow if duration >= threshold (ms). Default: 1000. */
  slowQueryThresholdMs?: number;
  /** Run EXPLAIN when duration >= this value (ms). Default: 500. */
  explainThresholdMs?: number;
  /** Attach lightweight recommendations derived from plan heuristics. Default: true. */
  recommendations?: boolean;
  /** Sample analyzed queries with probability in [0,1]. Default: 1 (no sampling). */
  sampleRate?: number;
  /** Hard cap of analysis events per minute per provider instance. Default: 120. */
  rateLimitPerMinute?: number;
  /** Timeout for collecting EXPLAIN (ms). Default: 1000. */
  explainTimeoutMs?: number;
  /** Max chars to keep from serialized plan; oversize plans are truncated. Default: 65536. */
  maxExplainChars?: number;
  /** Analyze only SELECT statements when true. Default: true. */
  onlySelect?: boolean;
}

/** Detailed analysis info reported to loggers/middlewares. */
export interface QueryAnalysisInfo {
  sql: string;
  params: readonly SqlParameter[];
  durationMs: number;
  provider?: string;
  /** True if duration exceeded slow threshold. */
  slow?: boolean;
  /** Optional textual plan or JSON depending on provider support. */
  explainPlan?: unknown;
  /** Optional best-effort list of hints derived from the plan. */
  recommendations?: ReadonlyArray<string>;
}

/** Optional hook for receiving query analysis events. */
export interface QueryAnalysisLogger {
  analysis?(info: QueryAnalysisInfo): void;
}

/** Context passed to advanced retry decision hooks. */
export interface RetryDecisionInfo {
  error: unknown;
  attempt: number; // 1-based
  inTransaction: boolean;
  sql?: string;
  params?: readonly SqlParameter[];
  provider?: string;
}

/** Circuit breaker event for logger hooks. */
export interface CircuitEventInfo {
  state: CircuitState;
  provider?: string;
  failures?: number;
  reason?: string;
  halfOpenInFlight?: number;
}

/** Information about a fallback attempt for logging/metrics. */
export interface FallbackInfo {
  /** Logical name of primary provider that failed. */
  provider?: string;
  /** Label of the fallback source (e.g., replica, memory). */
  fallback: string;
  /** True when this record represents an attempt; false may be used for summaries. */
  attempted: boolean;
  /** Whether the fallback succeeded. Present only after attempt. */
  succeeded?: boolean;
  /** Optional error captured when attempt failed. */
  error?: Error;
  /** When true, indicates fallback was skipped due to throttling. */
  throttled?: boolean;
  /** True when data is potentially stale (e.g., from replica). */
  isStale?: boolean;
  /** Optional timestamp (ms since epoch) when data snapshot is valid (as-of). */
  asOf?: number;
  /** Optional explicit source label for metrics/tracing. */
  source?: string;
}

/** Request passed to a fallback source to resolve data for a failed query. */
export interface FallbackRequest<T> {
  /** Entity constructor for the query. */
  entity: new () => T;
  /** SQL text that was intended for the primary provider. */
  sql: string;
  /** Positional SQL parameters. */
  params: readonly SqlParameter[];
}

/** Custom fallback source contract for graceful degradation. */
export interface QueryFallback<T> {
  /** Human-readable label for metrics (e.g., 'replica', 'memory'). */
  readonly label: string;
  /**
   * Return alternative data when the primary provider fails. Return null to skip (try next fallback).
   * Implementations must be side-effect free and read-only.
   */
  fetch(request: FallbackRequest<T>): Promise<ReadonlyArray<T> | null> | ReadonlyArray<T> | null;
  /** Optional server-side count for performance; if not provided, client will length(). */
  fetchCount?(request: FallbackRequest<T>): Promise<number | null> | number | null;
}

/** What operations are eligible for fallback. */
export type FallbackOperation = 'select' | 'count' | 'first' | 'single' | 'any' | 'aggregate';

/** Source selector names for policy. */
export type FallbackSource = 'replica' | 'memory' | string;

/** Rate limiting/throttling options for fallback usage. */
export interface FallbackThrottleOptions {
  /** Max fallback attempts per process per minute. */
  maxPerMinute?: number;
  /** Min spacing between fallbacks (ms). */
  minIntervalMs?: number;
  /** Optional jitter (0..1) applied to minInterval to reduce sync herd. */
  jitterRatio?: number;
}

/** Read freshness constraints for replica fallbacks. */
export interface FreshnessConstraints {
  /** Maximum allowed replication lag in milliseconds. */
  maxReplicationLagMs?: number;
  /** Require read-only connection semantics. */
  requireReadOnly?: boolean;
}

/** Policy controlling when and how graceful degradation is applied. */
export interface FallbackPolicy {
  /** Enable or disable fallback globally (default: true). */
  enabled?: boolean;
  /** Allowed operations for fallback. Default: ['select','count','first','single','any','aggregate']. */
  allowOps?: ReadonlyArray<FallbackOperation>;
  /** Preferred source order (labels). Default: declared order in Queryable.fallbackTo(). */
  sources?: ReadonlyArray<FallbackSource>;
  /** Rate limiting options to avoid thundering herds. */
  throttle?: FallbackThrottleOptions;
  /** Freshness constraints primarily for replicas. */
  freshness?: FreshnessConstraints;
  /** Hedged-requests configuration (race primary vs fallback after short delay). */
  hedged?: {
    /** Enable hedged requests for eligible operations (e.g., 'select', 'count'). */
    enabled?: boolean;
    /** Delay before starting fallback race (ms). Typical range 5..50ms. */
    delayMs?: number;
    /** Optional subset/priority of sources to use for hedging. */
    sources?: ReadonlyArray<FallbackSource>;
  };
  /** Whether to allow executing include() population on fallback results. */
  allowIncludesOnFallback?: 'none' | 'attempt';
}

/** Middleware hooks for cross-cutting concerns (tracing, metrics, etc.). */
export interface OrmMiddleware {
  beforeExecute?(info: {
    sql: string;
    params: readonly SqlParameter[];
    traceId?: string;
  }): void | Promise<void>;
  afterExecute?(info: {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    traceId?: string;
    rows?: number;
    error?: Error;
  }): void | Promise<void>;
  entityMaterialized?(info: { entity: object; metadata?: EntityMetadata }): void | Promise<void>;
  /** Optional hook for receiving query analysis events. */
  analysis?(info: QueryAnalysisInfo): void | Promise<void>;
}

/**
 * Result type for non-exceptional control flow.
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
/** Create a successful Result. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/** Create a failed Result. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Generic database error with optional engine-specific code. */
export class DatabaseError extends Error {
  public code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

/** Unique constraint violation error. */
export class UniqueConstraintError extends DatabaseError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'UniqueConstraintError';
  }
}

/** Foreign key constraint violation error. */
export class ForeignKeyConstraintError extends DatabaseError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'ForeignKeyConstraintError';
  }
}

/** Validation error for model constraints before persistence. */
export class ValidationError extends Error {
  public details?: Array<{ entity: string; property: string; message: string }>;
  constructor(
    message: string,
    details?: Array<{ entity: string; property: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/** Optimistic concurrency violation error. */
export class OptimisticConcurrencyError extends DatabaseError {
  constructor(message: string = 'Optimistic concurrency check failed', code?: string) {
    super(message, code);
    this.name = 'OptimisticConcurrencyError';
  }
}

/** Thrown when a call is short-circuited due to an open circuit. */
export class CircuitOpenError extends Error {
  constructor(message: string = 'Circuit is open; call short-circuited') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/** Known engine-specific error code aliases (best-effort). */
export type SqliteErrorCode =
  | 'SQLITE_CONSTRAINT'
  | 'SQLITE_CONSTRAINT_UNIQUE'
  | 'SQLITE_CONSTRAINT_FOREIGNKEY'
  | 'SQLITE_CONSTRAINT_TRIGGER'
  | string;
export type PostgresErrorCode = '23505' | '23503' | string;
export type MysqlErrorCode = 'ER_DUP_ENTRY' | string;
export type MssqlErrorNumber = 2627 | 2601 | number;

/**
 * Branded type system for Entity IDs to prevent mixing IDs of different entities.
 * This provides compile-time safety by making ID types nominally distinct.
 */
export type Brand<T, U> = T & { readonly __brand: U };

/**
 * Base branded ID type. Use with specific entity names:
 * type UserId = EntityId<number, 'User'>;
 * type OrderId = EntityId<string, 'Order'>;
 */
export type EntityId<T extends string | number, EntityName extends string> = Brand<T, EntityName>;

/**
 * Extract the underlying value from a branded type.
 * Useful when interfacing with external APIs that don't use branded types.
 */
export function unbrandId<T extends string | number, EntityName extends string>(
  id: EntityId<T, EntityName>
): T {
  return id as T;
}

/**
 * Brand a raw ID value for type safety.
 * Use this when receiving IDs from external sources.
 */
export function brandId<T extends string | number, EntityName extends string>(
  id: T
): EntityId<T, EntityName> {
  return id as EntityId<T, EntityName>;
}

/**
 * Type predicate to check if a value is a valid branded ID.
 * Primarily for runtime validation and type narrowing.
 */
export function isBrandedId<T extends string | number, EntityName extends string>(
  value: unknown
): value is EntityId<T, EntityName> {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Utility type to extract entity name from a branded ID type.
 * Useful for generic operations and metadata handling.
 */
export type ExtractEntityName<T> = T extends EntityId<string | number, infer U> ? U : never;

/**
 * Utility type to extract the underlying ID type from a branded ID.
 */
export type ExtractIdType<T> = T extends EntityId<infer U, string> ? U : never;

/**
 * Make specified properties of T readonly (DX helper).
 */
export type MakeReadonly<T, K extends keyof T> = Omit<T, K> & { readonly [P in K]: T[P] };

/**
 * Shape for INSERT operations excluding computed/read-only keys.
 * Provide K as a union of keys you consider computed/read-only in your entity.
 */
export type InsertShape<T, K extends keyof T = never> = Omit<T, K>;

/**
 * Shape for UPDATE operations excluding computed/read-only keys (all other fields optional).
 * Provide K as a union of keys you consider computed/read-only in your entity.
 */
export type UpdateShape<T, K extends keyof T = never> = Partial<Omit<T, K>>;

/**
 * Extract primary key type from an entity by convention. If the entity has an `id` property,
 * this yields its type (supports branded IDs). Otherwise resolves to never.
 */
export type PrimaryKeyOf<T> = T extends { id: infer P } ? P : never;
