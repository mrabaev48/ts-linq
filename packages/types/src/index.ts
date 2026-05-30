// Pure type definitions and interfaces - NO imports from other packages

// Basic SQL types
export type SqlParameter = string | number | boolean | Date | Uint8Array | null;

// Query types
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

/**
 * Temporal query mode — mirrors EF Core's five system-versioned table operators.
 * Only supported by MSSQL (SQL Server FOR SYSTEM_TIME clause).
 */
export type TemporalMode = 'AsOf' | 'All' | 'Between' | 'FromTo' | 'ContainedIn';

/**
 * Describes a temporal query constraint to be appended to a FROM clause.
 * `from` is required for AsOf, Between, FromTo, ContainedIn.
 * `to` is required for Between, FromTo, ContainedIn.
 */
export interface TemporalClause {
  readonly mode: TemporalMode;
  readonly from?: Date;
  readonly to?: Date;
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
  cte?: { name: string; sql: string };
  rawSqlSource?: { readonly sql: string; readonly params: readonly SqlParameter[] };
  /** Temporal query constraint for SQL Server system-versioned tables (FOR SYSTEM_TIME). */
  temporal?: TemporalClause;
}

// Entity metadata types
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

// Logger interface
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// Logger info types for SqlLogger methods
export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface QueryStartInfo {
  sql: string;
  params: readonly SqlParameter[];
  traceId?: string;
  provider?: string;
  /** True when the query was executed via a CapturedQueryPlan (compiled query). */
  compiledPlan?: boolean;
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

// Cross-query chunk logging params
export interface CrossQueryParams {
  op: 'IN-chunk';
  chunks: number;
  size: number;
  entity: string;
  column: string;
  provider?: string;
}

// Cache size reporting params
export interface CacheSizeInfo {
  cache: 'sqlGen' | 'count' | 'entityL2';
  size: number;
  provider?: string;
}

// SqlLogger extends Logger with additional methods for database event logging
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
  crossQuery?(params: CrossQueryParams): void;
  cacheSize?(params: CacheSizeInfo): void;
}

// SqlLoggerFactory for creating dialect-specific loggers
export interface SqlLoggerFactory {
  create(provider: 'mysql' | 'postgresql' | 'mssql' | string): SqlLogger | undefined;
}

// SQL dialect result types
export interface SqlQueryResult {
  query: string;
  parameters: readonly SqlParameter[];
}

export interface SqlWithParams {
  sql: string;
  parameters: SqlParameter[];
}

export interface SqlWithReturning extends SqlWithParams {
  returningPk?: string;
}

/** Result from a dialect batch INSERT — sql + params for the multi-row statement. */
export interface BatchInsertResult {
  sql: string;
  parameters: SqlParameter[];
  /** Whether the INSERT statement itself returns the inserted rows inline (PG RETURNING, MSSQL OUTPUT).
   *  When false, a separate query is needed to retrieve generated PKs (e.g. MySQL LAST_INSERT_ID). */
  returnsRows?: boolean;
  /** Optional SELECT to retrieve the first auto-generated ID after INSERT (MySQL only). */
  fetchFirstInsertIdSql?: string;
}

/** Result from a dialect batch UPDATE.
 *  PG / MSSQL return a single CTE/JOIN statement; MySQL returns multiple per-row statements. */
export interface BatchUpdateResult {
  /** Single multi-row statement (Postgres / MSSQL). */
  sql?: string;
  parameters?: SqlParameter[];
  /** Multiple per-row statements (MySQL). */
  statements?: Array<{ sql: string; parameters: SqlParameter[] }>;
}

// Bulk DML (ExecuteUpdate / ExecuteDelete) types

/** Describes one SET assignment in a bulk UPDATE. */
export interface SetterSpec {
  columnName: string;
  value: { kind: 'literal'; params: SqlParameter[] } | { kind: 'column'; refColumnName: string };
}

/** Context passed to SqlDialect.buildBulkUpdate(). */
export interface BulkUpdateContext {
  tableName: string;
  setters: SetterSpec[];
  where: WhereClause[];
}

/** Context passed to SqlDialect.buildBulkDelete(). */
export interface BulkDeleteContext {
  tableName: string;
  where: WhereClause[];
}

// SQL Dialect interface
export interface SqlDialect {
  buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult;
  buildInsert?(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning;
  buildUpdate?(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams;
  buildDelete?(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams;
  quoteIdentifier(identifier: string): string;
  /** Maximum number of bind parameters this dialect/driver supports per statement. */
  readonly parameterLimit?: number;
  buildBatchInsert?(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult;
  buildBatchUpdate?(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult;
  buildBatchDelete?(entities: Record<string, unknown>[], metadata: EntityMetadata): SqlWithParams;
  /** Bulk UPDATE: single-statement SET ... WHERE without loading entities. */
  buildBulkUpdate?(ctx: BulkUpdateContext): SqlWithParams;
  /** Bulk DELETE: single-statement DELETE ... WHERE without loading entities. */
  buildBulkDelete?(ctx: BulkDeleteContext): SqlWithParams;
}

// Middleware hook parameter types
export interface BeforeExecuteInfo {
  sql: string;
  params: readonly SqlParameter[];
  traceId?: string;
}

export interface AfterExecuteInfo {
  sql: string;
  params: readonly SqlParameter[];
  durationMs: number;
  traceId?: string;
  rows?: number;
}

// Middleware context types
export interface EntityChangeContext {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: 'added' | 'modified' | 'deleted';
  originalValues?: Record<string, unknown>;
}

// Middleware types
export interface OrmMiddleware {
  // SQL execution hooks
  beforeExecute?(info: BeforeExecuteInfo): Promise<void> | void;
  afterExecute?(info: AfterExecuteInfo): Promise<void> | void;
  entityMaterialized?<T extends object>(entity: T | { entity: T; metadata?: EntityMetadata }): void;
  analysis?(info: QueryAnalysisInfo): void;

  // Entity lifecycle hooks
  beforeSave?(context: EntityChangeContext): Promise<void> | void;
  afterSave?(context: EntityChangeContext): Promise<void> | void;
  beforeDelete?(context: EntityChangeContext): Promise<boolean | void> | boolean | void; // return true to handle delete (soft-delete)
  afterDelete?(context: EntityChangeContext): Promise<void> | void;
}

// Retry policy types
export interface RetryPolicy {
  shouldRetry(error: unknown, attempt: number, inTransaction?: boolean): boolean;
  getDelayMs?(attempt: number): number;
}

/** Options for ExecutionStrategy / EnableRetryOnFailure. Mirrors EF Core's overload. */
export interface ExecutionStrategyOptions {
  /** Maximum number of retry attempts before giving up. */
  maxRetryCount: number;
  /** Maximum delay between retries in milliseconds. */
  maxRetryDelay: number;
  /** Additional provider-specific error codes to treat as transient. Pass null to use defaults only. */
  errorCodesToAdd?: string[] | null;
}

// Connection options
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

// Soft delete options
export interface SoftDeleteOptions {
  enabled?: boolean;
  column?: string;
  columnName?: string;
  /** Optional timestamp column used by timestamp-based soft delete. */
  deletedAtColumn?: string;
  type?: 'boolean' | 'timestamp';
}

// Base provider configuration
export interface BaseProviderConfig {
  logger?: SqlLogger;
  middlewares?: OrmMiddleware[];
  softDelete?: SoftDeleteOptions;
  retryPolicy?: RetryPolicy;
  poolOptions?: ConnectionPoolOptions;
  healthCheck?: ConnectionHealthCheckOptions;
}

// PostgreSQL provider configuration
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
  /** Optional: Inject existing pg.Pool instance */
  pool?: object;
}

// MySQL provider configuration
export interface MySqlConfig extends BaseProviderConfig {
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
  socketPath?: string;
  charset?: string;
  timezone?: string;
  /** Optional: Inject existing mysql2 Pool instance */
  pool?: object;
}

// MSSQL provider configuration
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
  /** Optional: Inject existing mssql ConnectionPool instance */
  pool?: object;
}

// Global filter
export interface GlobalFilter {
  filterName: string;
  entity?: string;
  where?: WhereClause;
  predicate?: (query: QueryOptions) => QueryOptions;
}

// Join type
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

// CTE Definition
export interface CteDefinition {
  name: string;
  query?: string;
  sql?: string;
  parameters?: SqlParameter[];
}

// Result type
export interface Result<T, E = Error> {
  success: boolean;
  value?: T;
  error?: E;
}

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

// Fallback types
export type FallbackOperation =
  | 'select'
  | 'count'
  | 'aggregate'
  | 'insert'
  | 'update'
  | 'delete'
  | 'first'
  | 'single'
  | 'any';

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
    sources?: string[];
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

// Cache metrics
export interface SqlCacheMetrics {
  currentSize: number;
  totalRequests?: number;
  hits?: number;
  misses?: number;
  evictions?: number;
  invalidations?: number;
}

// Count cache interface
export interface CountCache {
  get(key: string): number | undefined;
  set(key: string, value: number): void;
  clear(): void;
  /** Optional targeted invalidation. Should return number of removed entries. */
  invalidateBy?(matcher: (key: string) => boolean): number;
  /** Optional metrics exposure for monitoring. */
  getMetrics?(): Pick<SqlCacheMetrics, 'currentSize'>;
}

// SQL Cache interfaces
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
  getMetrics?(): SqlCacheMetrics;
}

/**
 * Extended SQL cache interface used by CapturedQueryPlan.
 * Caches SQL templates keyed by query structure (without parameter values),
 * allowing the same SQL to be reused with different bound parameters.
 */
export interface TemplateSqlCache extends SqlCache {
  /** Get cached SQL template by structure-only key. Returns undefined on miss. */
  getTemplate(key: string): { query: string } | undefined;
  /** Number of plan cache hits (SQL template reuses). */
  readonly cacheHits: number;
  /** Number of plan cache misses (SQL generations). */
  readonly cacheMisses: number;
}

/** Type guard for TemplateSqlCache. */
export function isTemplateSqlCache(cache: SqlCache): cache is TemplateSqlCache {
  return typeof (cache as TemplateSqlCache).getTemplate === 'function';
}

// Performance options
export interface PerformanceOptions {
  enableQueryCache?: boolean;
  enableCountCache?: boolean;
  enableEntityCache?: boolean;
  queryTimeout?: number;
  countCache?: CountCache;
  countCacheTtlMs?: number;
  sqlCache?: SqlCache;
  cacheNamespace?: string;
  fallbackPolicy?: FallbackPolicy;
  entityCache?: EntityCacheLike;
  entityCacheSize?: number;
  /** Optional IN() chunk size for large value lists. */
  inClauseChunkSize?: number;
  analysis?: Record<string, unknown>;
}

// Loading strategy enum
export enum LoadingStrategy {
  Lazy = 'lazy',
  Eager = 'eager',
  Explicit = 'explicit'
}

// Cache options
export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// Metadata types for decorators
export type ColumnType =
  | 'INTEGER'
  | 'TEXT'
  | 'REAL'
  | 'BLOB'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIMESTAMP'
  | string;

export interface ValueConverterLike<TModel = unknown, TProvider = unknown> {
  toProvider(v: TModel): TProvider;
  fromProvider(v: TProvider): TModel;
}

export interface ValueComparerLike<T = unknown> {
  equals(a: T, b: T): boolean;
  hash(v: T): number;
  snapshot(v: T): T;
}

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
  isConcurrencyToken?: boolean;
  converter?: ValueConverterLike;
  comparer?: ValueComparerLike;
}

export enum DeleteBehavior {
  Cascade = 'Cascade',
  Restrict = 'Restrict',
  SetNull = 'SetNull',
  ClientSetNull = 'ClientSetNull',
  NoAction = 'NoAction',
  ClientCascade = 'ClientCascade',
  ClientNoAction = 'ClientNoAction'
}

export interface RelationshipMetadata {
  propertyName: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
  targetEntity: string | Function | (() => Function) | undefined;
  foreignKey?: string;
  inverseSide?: string;
  cascade?: boolean;
  through?: string | object;
  onDelete?: DeleteBehavior;
  nullable?: boolean;
}

export interface IndexMetadata {
  name: string;
  columns: string[];
  unique?: boolean;
  where?: string;
  orders?: { [column: string]: 'ASC' | 'DESC' };
  expressions?: string[];
  collations?: { [column: string]: string };
  nulls?: { [column: string]: 'FIRST' | 'LAST' };
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

export enum StorageStrategy {
  TableSplit = 'TableSplit',
  SeparateTable = 'SeparateTable',
  Json = 'Json'
}

export enum InheritanceStrategy {
  Tph = 'Tph',
  Tpt = 'Tpt',
  Tpc = 'Tpc'
}

export interface DiscriminatorEntry {
  ctor: Function;
  value: unknown;
}

export interface DiscriminatorMetadata {
  columnName: string;
  columnType: string;
  entries: DiscriminatorEntry[];
  isComplete: boolean;
}

export interface HierarchyMetadata {
  strategy: InheritanceStrategy;
  rootEntity: Function;
  discriminator?: DiscriminatorMetadata;
  subtypes: Function[];
}

export interface OwnedEntityMetadata {
  ownerPropertyName: string;
  ownedType: Function;
  strategy: StorageStrategy;
  columnPrefix?: string;
  jsonColumnName?: string;
  foreignKeyColumns?: string[];
  principalKeyColumns?: string[];
  compositeKeyColumns?: string[];
  isCollection: boolean;
}

export interface SkipNavigationMetadata {
  /** Property name on the owning entity (e.g. "tags" on Post). */
  propertyName: string;
  /** Constructor of the related entity (e.g. Tag). */
  targetEntity: Function;
  /** Name of the join table (e.g. "PostTag"). */
  joinTableName: string;
  /** Synthetic or explicit join entity constructor registered in MetadataRegistry. */
  joinEntityCtor: Function;
  /** FK column on the join table pointing back to the owning entity (e.g. "postId"). */
  leftForeignKey: string;
  /** FK column on the join table pointing to the related entity (e.g. "tagId"). */
  rightForeignKey: string;
  /** Property name of the inverse navigation on the related entity (e.g. "posts" on Tag). */
  inverseSide?: string;
  /** True when the join entity was auto-synthesised (no explicit UsingEntity call). */
  isSynthesized: boolean;
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
  /** Whether this entity maps to a SQL Server system-versioned (temporal) table. */
  isTemporal?: boolean;
  /** Custom history table name (default: `tableName + 'History'`). */
  historyTableName?: string;
  ownedEntities?: OwnedEntityMetadata[];
  /** Hierarchy metadata — present on the root entity of a TPH/TPT/TPC hierarchy. */
  hierarchy?: HierarchyMetadata;
  /** Points to the root entity constructor — present on every subtype in a hierarchy. */
  hierarchyRoot?: Function;
  /** Skip navigation metadata for many-to-many relationships (P0-08). */
  skipNavigations?: SkipNavigationMetadata[];
}

// Entity cache interface
export interface EntityCacheLike {
  get<T>(entityClass: Function, id: unknown): T | undefined;
  set<T>(entityClass: Function, id: unknown, entity: T): void;
  remove(entityClass: Function, id: unknown): void;
  clear(): void;
  size?(): number;
}

// Loading defaults
export interface LoadingDefaults {
  strategy?: LoadingStrategy;
  maxDepth?: number;
  depth?: number;
}

// Audit options
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

// Export error classes
export {
  DatabaseError,
  ForeignKeyConstraintError,
  OptimisticConcurrencyError,
  TemporalNotSupportedError,
  UniqueConstraintError,
  ValidationError
} from './errors';

// Additional ORM-related properties
export interface PerformanceOptionsExtended extends PerformanceOptions {
  // Backward compatible alias; all fields live in PerformanceOptions.
}

export interface SoftDeleteOptionsExtended extends SoftDeleteOptions {
  // Backward compatible alias; all fields live in SoftDeleteOptions.
}

/** Minimal interface for attaching entities to a change tracker. Used by Queryable to avoid circular deps. */
export interface EntityAttacher {
  attach(entity: object, entityClass: Function): void;
}

/**
 * Specification for a filtered include — captures the in-memory filter/sort/limit
 * that is applied to related entities after they are fetched from the database.
 * Lives in @ts-linq/types so both @ts-linq/core (EntityLoader) and @ts-linq/query
 * (IncludeSubquery, IncludePlanner) can reference it without creating a circular dep.
 */
export interface FilteredIncludeSpec {
  readonly propertyName: string;
  /**
   * Apply filter/sort/pagination to the full set of related entities for a single parent.
   * Called once per parent with all matching rows; returns the subset to assign.
   */
  applyFilter(items: unknown[]): unknown[];
}

/**
 * Controls whether queries with collection Includes are executed as a single
 * SQL statement with JOINs (SingleQuery) or as a series of separate statements
 * (SplitQuery). Mirrors EF Core's QuerySplittingBehavior.
 *
 * ## SplitQuery (recommended default)
 * Each Include path that targets a collection navigation is loaded via a
 * separate batched IN-query against the database, preventing cartesian-product
 * row explosion at the cost of additional round trips.
 *
 * ## SingleQuery
 * All data is retrieved in a single SQL statement. For queries with multiple
 * collection Includes this can produce cartesian explosion (N × M rows).
 * Prefer this mode only when the result set is known to be small.
 *
 * > **Warning (mirrors EF Core):** Split queries are not transactionally
 * > consistent unless the caller wraps the operation in an explicit transaction.
 */
export enum QuerySplittingBehavior {
  /** One SQL SELECT per collection Include path. Avoids cartesian explosion. */
  SplitQuery = 'SplitQuery',
  /** Single SQL SELECT with JOINs for all Includes. May cause cartesian explosion. */
  SingleQuery = 'SingleQuery'
}

/** Entity state for change tracking */
export enum EntityState {
  Unchanged = 'unchanged',
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted'
}

/** Tracked entity with state for change tracking */
export interface TrackedEntity {
  entity: object;
  entityClass: Function;
  state: EntityState;
  originalValues?: object;
}

/**
 * HierarchyId translator interface for dialect-specific SQL function mapping.
 * Implementations live in each @ts-linq/dialect-* package.
 * Used by HierarchyMethodVisitor in @ts-linq/sql-visitor.
 */
export interface HierarchyIdTranslator {
  isDescendantOf(col: string, param: string): string;
  getLevel(col: string): string;
  getAncestor(col: string, param: string): string;
}

/**
 * Spatial translator interface for dialect-specific SQL spatial function mapping.
 * Implementations live in each @ts-linq/dialect-* package.
 * Used by SpatialMethodVisitor in @ts-linq/sql-visitor.
 */
export interface SpatialTranslator {
  distance(col: string, param: string): string;
  intersects(col: string, param: string): string;
  within(col: string, param: string): string;
  buffer(col: string, param: string): string;
  area(col: string): string;
  length(col: string): string;
  contains(col: string, param: string): string;
}

// ── Diagnostic / logging types (P2-45) ───────────────────────────────────────

/** Severity levels mirroring EF Core's LogLevel enum. */
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'information'
  | 'warning'
  | 'error'
  | 'critical'
  | 'none';

/** Action to take when a diagnostic event matches a configured warning route. */
export type WarningBehavior = 'throw' | 'log' | 'suppress';

/**
 * Configuration produced by DbContextOptionsBuilder logging methods.
 * Consumed by DiagnosticEmitter in @ts-linq/telemetry.
 */
export interface DiagnosticConfig {
  /** User-supplied sink function; receives formatted diagnostic messages. */
  sink?: (message: string) => void;
  /** Minimum severity that will be forwarded to the sink. Defaults to 'information'. */
  level?: LogLevel;
  /** When true, raw SQL parameter values are included in messages. Defaults to false (masked). */
  sensitiveDataEnabled?: boolean;
  /** When true, full stack traces are appended to error messages. Defaults to false. */
  detailedErrors?: boolean;
  /** Per-event routing overrides: eventId → 'throw' | 'log' | 'suppress'. */
  warningRoutes?: ReadonlyMap<string, WarningBehavior>;
}
