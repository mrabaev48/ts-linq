import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import type {
  EntityCacheLike,
  ExecutionStrategyOptions,
  GlobalFilter,
  PerformanceOptions,
  QuerySplittingBehavior,
  SoftDeleteOptions
} from '@ts-linq/types';

import type { ChangeTracker } from './ChangeTracker';

export interface DbSetContext {
  provider: DatabaseProvider;
  changeTracker: ChangeTracker;
  entityLoader?: EntityLoader;
  entityCache?: EntityCacheLike;
  performance?: PerformanceOptions;
  globalFilters?: GlobalFilter[];
  softDeleteOptions?: SoftDeleteOptions;
  /** Global query-splitting default propagated from DbContextOptions. */
  querySplittingBehavior?: QuerySplittingBehavior;
  /** Transaction lifecycle callbacks provided by DbContext. */
  beginTransaction?: () => Promise<void>;
  commitTransaction?: () => Promise<void>;
  rollbackTransaction?: () => Promise<void>;
  /** ExecutionStrategy options set via DbContextOptionsBuilder.enableRetryOnFailure(). */
  executionStrategyOptions?: ExecutionStrategyOptions;
}
