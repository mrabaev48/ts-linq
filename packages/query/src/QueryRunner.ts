import type { QueryTrackingBehavior } from '@ts-linq/core';
import type { CteDefinition, QuerySplittingBehavior } from '@ts-linq/types';
import type { EntityAttacher } from '@ts-linq/types';

import type { IncludeSubquery } from './include/IncludeSubquery';
import type { QueryExecutor } from './QueryExecutor';
import type { QueryModel } from './QueryModel';
import type { TrackingCoordinator } from './TrackingCoordinator';

/**
 * Everything needed to run one terminal operation (`toArray`/`first`/`firstOrDefault`/`any`).
 *
 * `executor` is supplied per call rather than held on the runner: `Queryable.clone()` re-creates the
 * executor (rebinding the per-clone FallbackManager), so reading it from the live facade keeps the
 * runner clone-safe and stateless with respect to the chain.
 */
export interface RunSpec<T> {
  model: QueryModel;
  executor: QueryExecutor<T>;
  entityClass: new () => T;
  includes: string[];
  cte: CteDefinition | undefined;
  splitting: QuerySplittingBehavior;
  filteredIncludes: Map<string, IncludeSubquery<unknown>> | undefined;
  abortSignal: AbortSignal | undefined;
  trackingMode: QueryTrackingBehavior;
  attacher: EntityAttacher | undefined;
}

/**
 * Orchestrates terminal query execution: abort check → execute + materialize → (optional)
 * change-tracking. The `single`/`singleOrDefault`/`contains` operators stay on the facade as they
 * are pure post-processing of `toArray()`.
 *
 * Holds only the stateless {@link TrackingCoordinator}; shared by reference across clones.
 */
export class QueryRunner {
  constructor(private readonly tracking: TrackingCoordinator) {}

  /** Execute and materialize without applying tracking (used by `any`). */
  async materialize<T>(spec: RunSpec<T>): Promise<T[]> {
    if (spec.abortSignal?.aborted) throw new Error('Operation aborted');
    return spec.executor.executeAndMaterialize(
      spec.model,
      spec.includes,
      spec.cte,
      spec.splitting,
      spec.filteredIncludes
    );
  }

  /** Execute, materialize and apply change-tracking / identity-resolution. */
  async toList<T>(spec: RunSpec<T>): Promise<T[]> {
    const entities = await this.materialize(spec);
    return this.tracking.apply(entities, spec.entityClass, spec.trackingMode, spec.attacher);
  }
}
