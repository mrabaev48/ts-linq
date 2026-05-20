// Core-specific types only - canonical location for types tightly coupled to core internals.
// Domain contracts (EntityState, TrackedEntity) and logger event types live in @ts-linq/types.
// Consumers should import those directly from @ts-linq/types.

import type { CircuitState } from '@ts-linq/types';

/**
 * Structural contract for a database provider.
 * Declared here (not in DatabaseProvider.ts) to break the circular dependency:
 *   DatabaseProvider → ResilienceManager → types/index → DatabaseProvider
 * The concrete `DatabaseProvider` abstract class explicitly implements this interface.
 */
export interface IDatabaseProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createTable(entityMetadata: import('@ts-linq/types').EntityMetadata): Promise<void>;
  getDialect(): import('@ts-linq/types').SqlDialect;
  insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
  update<T extends object>(entity: T, entityClass: Function): Promise<T>;
  delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
  findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
  findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
  findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]>;
  findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]>;
  insertMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]>;
  updateMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]>;
  upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
  upsertMany<T extends object>(entities: T[], entityClass: Function): Promise<T[]>;
  executeQuery<T>(
    sql: string,
    params?: readonly import('@ts-linq/types').SqlParameter[]
  ): Promise<T[]>;
  executeNonQuery(
    sql: string,
    params?: readonly import('@ts-linq/types').SqlParameter[]
  ): Promise<number>;
  configureQueryAnalysis(options?: QueryPerformanceAnalysisOptions): void;
  readonly circuitStateLabel: CircuitState;
  configureCircuit(options: CircuitBreakerOptions): void;
  readonly softDeleteOptions: import('@ts-linq/types').SoftDeleteOptions | undefined;
  configureSoftDelete(options?: import('@ts-linq/types').SoftDeleteOptions): void;
  readonly providerLabel: string;
  readonly loggerRef: import('@ts-linq/types').SqlLogger | undefined;
  configureConnection(options: {
    pool?: import('@ts-linq/types').ConnectionPoolOptions;
    health?: import('@ts-linq/types').ConnectionHealthCheckOptions;
  }): void;
  forceOpen(reason: string, durationMs?: number): void;
  manualReset(reason?: string): void;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  readonly connected: boolean;
  readonly inTransactionState: boolean;
}

/** Options for constructing a database context */
export interface DbContextOptions {
  provider: IDatabaseProvider;
  /**
   * Metadata registry to use for this context.
   * Defaults to the process-wide registry (`MetadataStorage.getInstance()`).
   * Provide an isolated `MetadataRegistry` for multi-tenant setups or test isolation.
   */
  registry?: import('@ts-linq/metadata').MetadataRegistry;
  performance?: import('@ts-linq/types').PerformanceOptions;
  loading?: import('@ts-linq/types').LoadingDefaults;
  softDelete?: import('@ts-linq/types').SoftDeleteOptions;
  audit?: import('@ts-linq/types').AuditOptions;
  globalFilters?: import('@ts-linq/types').GlobalFilter[];
  middlewares?: import('@ts-linq/types').OrmMiddleware[];
  validation?: {
    translate?: (key: string, params?: Record<string, unknown>) => string;
  };
  diagnostics?: DiagnosticsOptions;
  /** EF-style interceptors registered via DbContextOptionsBuilder.addInterceptors(). */
  interceptors?: object[];
}

/** Circuit Breaker options */
export interface CircuitBreakerOptions {
  enabled?: boolean;
  failureThreshold?: number;
  openDurationMs?: number;
  maxOpenDurationMs?: number;
  halfOpenMaxCalls?: number;
  countTransientOnly?: boolean;
}

/** Read-only memory sample for diagnostics */
export interface MemorySampleInfo {
  timestampMs: number;
  rssBytes: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
  heapPressure: number;
}

/** Minimal profiler contract */
export interface MemoryProfilerLike {
  onSample(listener: (sample: MemorySampleInfo) => void): () => void;
  getAliveAllocations?(): number;
  start?(): void;
  stop?(): void;
  sample?(allowGc?: boolean): Promise<MemorySampleInfo> | MemorySampleInfo;
}

/** Diagnostics hooks and profilers */
export interface DiagnosticsOptions {
  memoryProfiler?: MemoryProfilerLike;
}

/** Options for controlling entity loading behavior */
export interface LoadingOptions {
  strategy?: import('@ts-linq/types').LoadingStrategy;
  includes?: string[];
  depth?: number;
}

/** Query result with metadata */
export interface QueryResult<T> {
  rows: T[];
  totalCount?: number;
  hasMore?: boolean;
}

/** Aggregate result */
export interface AggregateResult {
  count: number;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
}

// Core-specific utility type
export type PrimaryKeyOf<T> = T extends { id: infer K } ? K : unknown;

export interface RetryDecisionInfo {
  error: unknown;
  attempt: number;
  inTransaction: boolean;
  sql?: string;
  params?: readonly import('@ts-linq/types').SqlParameter[];
  provider?: string;
}

export interface QueryPerformanceAnalysisOptions {
  enabled?: boolean;
  slowQueryThresholdMs?: number;
  explainThresholdMs?: number;
  recommendations?: boolean;
  sampleRate?: number;
  rateLimitPerMinute?: number;
  explainTimeoutMs?: number;
  maxExplainChars?: number;
  onlySelect?: boolean;
}

export class CircuitOpenError extends Error {
  constructor(message: string = 'Circuit is open; call short-circuited') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
