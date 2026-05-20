import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import type {
  EntityCacheLike,
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
}
