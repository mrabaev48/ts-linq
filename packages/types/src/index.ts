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
}

export interface QueryOptions {
  select?: string[];
  where?: WhereClause;
  orderBy?: OrderByClause[];
  joins?: JoinClause[];
  groupBy?: string[];
  having?: WhereClause;
  limit?: number;
  offset?: number;
  distinct?: boolean;
  from?: string;
  cte?: { name: string; sql: string };
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

// SQL Dialect interface
export interface SqlDialect {
  buildSelect<T>(entityClass: new () => T, options: QueryOptions): {
    query: string;
    parameters: readonly SqlParameter[];
  };
  quoteIdentifier(identifier: string): string;
}

// Middleware types
export interface OrmMiddleware {
  beforeExecute?(sql: string, params: readonly SqlParameter[]): Promise<void> | void;
  afterExecute?(sql: string, result: unknown): Promise<void> | void;
  entityMaterialized?<T>(entity: T): void;
}

// Retry policy types
export interface RetryPolicy {
  shouldRetry(error: Error, attempt: number): boolean;
  getDelay(attempt: number): number;
}

// Connection options
export interface ConnectionPoolOptions {
  min?: number;
  max?: number;
  idleTimeoutMs?: number;
}

export interface ConnectionHealthCheckOptions {
  enabled?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
}

// Soft delete options
export interface SoftDeleteOptions {
  columnName?: string;
  type?: 'boolean' | 'timestamp';
}

// Cache options
export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// Export error classes
export * from './errors';
