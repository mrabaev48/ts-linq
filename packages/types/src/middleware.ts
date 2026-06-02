// Middleware hooks, entity change context and retry policy

import type { QueryAnalysisInfo } from './logging';
import type { EntityMetadata } from './metadata';
import type { SqlParameter } from './sql';

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
