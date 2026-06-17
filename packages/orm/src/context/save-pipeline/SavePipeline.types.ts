import type {
  DatabaseProvider,
  ISaveChangesInterceptor,
  SaveChangesEventData
} from '@ts-linq/core';
import type { EntityCtorRef } from '@ts-linq/types';

import type { ChangeTracker } from '../../ChangeTracker';
import type { InterceptorRegistry } from '../../interceptors/InterceptorRegistry';
import type { CacheCoordinator } from '../../services/CacheCoordinator';
import type { ChangeValidationService } from '../../services/ChangeValidationService';
import type { ChangeExecutor } from '../ChangeExecutor';
import type { TransactionScope } from '../TransactionScope';
import type { ValueGenerationService } from '../ValueGenerationService';

/** A single tracked change as returned by the change tracker. */
export type SaveChange = ReturnType<ChangeTracker['getChanges']>[number];

/** Cache-invalidation projection of a change (entity + class + state). */
export interface InvalidationChange {
  entity: Record<string, unknown>;
  entityClass: EntityCtorRef;
  state: string;
}

/**
 * Mutable working set threaded through the {@link SaveChangesPipeline} steps.
 * Carrying state explicitly (Value Object) removes hidden `this` coupling between
 * the save concerns.
 */
export interface SaveContext {
  /** Pending changes captured at the start of the save. */
  changes: readonly SaveChange[];
  /** Cache-invalidation projection computed during validation. */
  normalizedForInvalidation: readonly InvalidationChange[];
  /** Event payload shared across the interceptor callbacks. */
  eventData: SaveChangesEventData;
  /** Registered save-changes interceptors, in registration order. */
  interceptors: readonly ISaveChangesInterceptor[];
  /** Final affected-row count to return from `saveChanges`. */
  result: number;
  /** When true, remaining steps are skipped (empty set / suppression). */
  done: boolean;
}

/** Collaborators every {@link SaveStep} may use. */
export interface SavePipelineDeps {
  readonly provider: DatabaseProvider;
  readonly changeTracker: ChangeTracker;
  readonly valueGen: ValueGenerationService;
  readonly validationService: ChangeValidationService;
  readonly interceptorRegistry: InterceptorRegistry;
  readonly changeExecutor: ChangeExecutor;
  readonly cacheCoordinator: CacheCoordinator;
  readonly transactionScope: TransactionScope;
}

/**
 * One ordered concern of the save pipeline (Chain of Responsibility / Pipeline).
 * A step mutates the {@link SaveContext}; setting `ctx.done` short-circuits the
 * remaining steps.
 */
export interface SaveStep {
  execute(ctx: SaveContext, deps: SavePipelineDeps): Promise<void> | void;
}
