// Result type and fallback policy.
// The `ok`/`err` constructors live in ./runtime (the package's runtime module).

import type { EntityCtorRef } from './metadata';
import type { QueryOptions, SqlParameter } from './sql';

// Result type
export interface Result<T, E = Error> {
  success: boolean;
  value?: T;
  error?: E;
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
  entityClass: EntityCtorRef;
  entity?: EntityCtorRef;
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
