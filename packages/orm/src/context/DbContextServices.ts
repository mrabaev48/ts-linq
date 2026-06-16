import type {
  DatabaseProvider,
  DiagnosticsOptions,
  EntityLoader,
  LoadingStrategy,
  MemoryProfilerLike
} from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EnhancedSqlCache } from '@ts-linq/query/internal';
import type {
  EntityCacheLike,
  ExecutionStrategyOptions,
  GlobalFilter,
  LoadingDefaults,
  PerformanceOptions,
  QuerySplittingBehavior,
  SoftDeleteOptions
} from '@ts-linq/types';

import { type ChangeTrackerFacade } from '../ChangeTrackerFacade';
import { type DeleteCommand } from '../commands/DeleteCommand';
import { type FragmentDmlExecutor } from '../commands/FragmentDmlExecutor';
import { type InsertCommand } from '../commands/InsertCommand';
import { type UpdateCommand } from '../commands/UpdateCommand';
import { type InterceptorRegistry } from '../interceptors/InterceptorRegistry';
import { type EntityQueryFilterMap } from '../ModelBuilder';
import { type SpExecutor } from '../save-changes/sp-executor';
import { type AuditInterceptor } from '../services/AuditInterceptor';
import { type CacheCoordinator } from '../services/CacheCoordinator';
import { type ChangeValidationService } from '../services/ChangeValidationService';
import { type SoftDeleteInterceptor } from '../services/SoftDeleteInterceptor';

/**
 * Immutable value object holding every collaborator and resolved option that the
 * {@link DbContextBootstrapper} builds from `DbContextOptions`.
 *
 * Carrying state explicitly (rather than as ~25 mutable `!`-asserted fields on
 * `DbContext`) removes hidden `this` coupling and lets the context construct
 * deterministically: `this._services = DbContextBootstrapper.bootstrap(...)`.
 *
 * @internal Not part of the public `@ts-linq/orm` surface.
 */
export interface DbContextServices {
  readonly provider: DatabaseProvider;
  readonly registry: MetadataRegistry;
  readonly changeTracker: ChangeTrackerFacade;
  readonly entityLoader: EntityLoader;
  readonly validationService: ChangeValidationService;
  readonly insertCmd: InsertCommand;
  readonly updateCmd: UpdateCommand;
  readonly deleteCmd: DeleteCommand;
  readonly fragmentExecutor: FragmentDmlExecutor;
  readonly spExecutor: SpExecutor;
  readonly cacheCoordinator: CacheCoordinator;
  readonly auditInterceptor: AuditInterceptor;
  readonly softDeleteInterceptor: SoftDeleteInterceptor;
  readonly interceptorRegistry: InterceptorRegistry;
  /** SQL cache created and owned by this context (undefined when the user supplied their own). */
  readonly ownedSqlCache?: EnhancedSqlCache;
  readonly entityCache?: EntityCacheLike;
  readonly performanceOptions?: PerformanceOptions;
  readonly softDelete?: SoftDeleteOptions;
  readonly globalFilters?: GlobalFilter[];
  readonly diagnostics?: DiagnosticsOptions;
  readonly memoryProfiler?: MemoryProfilerLike;
  readonly querySplittingBehavior?: QuerySplittingBehavior;
  readonly executionStrategyOptions?: ExecutionStrategyOptions;
  /** maxBatchSize from DbContextOptionsBuilder.maxBatchSize(); 0 = per-row path. */
  readonly maxBatchSize: number;
  readonly entityQueryFilterMap: EntityQueryFilterMap;
  readonly loadingDefaults: LoadingDefaults;
  /** Resolved initial default loading strategy (DbContext tracks a mutable copy). */
  readonly defaultLoadingStrategy: LoadingStrategy;
}
