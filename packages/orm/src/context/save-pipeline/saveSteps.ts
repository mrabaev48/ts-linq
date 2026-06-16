import type { SaveChangesEventData } from '@ts-linq/core';
import { InterceptionResult } from '@ts-linq/core';
import type { EntityCtorRef } from '@ts-linq/types';
import { OptimisticConcurrencyError } from '@ts-linq/types';

import { EntityEntry } from '../../changetracker/EntityEntry';
import { DbUpdateConcurrencyException } from '../../exceptions/DbUpdateConcurrencyException';
import type { SaveChange, SaveContext, SavePipelineDeps, SaveStep } from './SavePipeline.types';

/** Validation projection of a tracked change (shadow values are not folded in here). */
interface ChangeForValidation {
  entity: Record<string, unknown>;
  entityClass: EntityCtorRef;
  state: string;
  originalValues?: object;
}

function normalizeForValidation(changes: readonly SaveChange[]): ChangeForValidation[] {
  return changes.map((c) => ({
    entity: c.entity as Record<string, unknown>,
    entityClass: c.entityClass,
    state: c.state,
    originalValues: c.originalValues
  }));
}

/** DetectChanges + Cascade + capture pending changes; short-circuit when empty. */
export class DetectChangesStep implements SaveStep {
  execute(ctx: SaveContext, deps: SavePipelineDeps): void {
    if (deps.changeTracker.autoDetectChangesEnabled) {
      deps.changeTracker.detectChanges();
    }
    deps.changeTracker.applyCascades();
    const changes = deps.changeTracker.getChanges();
    if (!changes || changes.length === 0) {
      ctx.result = 0;
      ctx.done = true;
      return;
    }
    ctx.changes = changes;
  }
}

/** Assign Hi-Lo ids to added entities (async pre-pass). */
export class PrefillIdsStep implements SaveStep {
  async execute(ctx: SaveContext, deps: SavePipelineDeps): Promise<void> {
    await deps.valueGen.prefillHiLoIds(ctx.changes);
  }
}

/** Fill defaults / run client-side value generators. */
export class PrefillDefaultsStep implements SaveStep {
  execute(ctx: SaveContext, deps: SavePipelineDeps): void {
    deps.valueGen.prefillDefaults(ctx.changes);
  }
}

/** Validate the change set and compute the cache-invalidation projection. */
export class ValidateStep implements SaveStep {
  execute(ctx: SaveContext, deps: SavePipelineDeps): void {
    const normalizedForValidation = normalizeForValidation(ctx.changes);
    deps.validationService.validate(normalizedForValidation);
    ctx.normalizedForInvalidation = normalizedForValidation.map((c) => ({
      entity: c.entity,
      entityClass: c.entityClass,
      state: c.state
    }));
  }
}

/** Build the interceptor event payload and capture the interceptor list. */
export class BuildEventDataStep implements SaveStep {
  execute(ctx: SaveContext, deps: SavePipelineDeps): void {
    const entries = ctx.changes.map((c) => ({
      entity: c.entity,
      entityClass: c.entityClass,
      state: c.state
    }));
    const eventData: SaveChangesEventData = { entityCount: entries.length, entries };
    ctx.eventData = eventData;
    ctx.interceptors = deps.interceptorRegistry.forEachSaveChanges();
  }
}

/** Run `savingChanges`; an interceptor may suppress (short-circuit) the save. */
export class SavingInterceptorsStep implements SaveStep {
  async execute(ctx: SaveContext, _deps: SavePipelineDeps): Promise<void> {
    let suppressResult = InterceptionResult.NoResult<number>();
    for (const ic of ctx.interceptors) {
      const r = await ic.savingChanges?.(ctx.eventData, suppressResult);
      if (r) suppressResult = r;
      if (suppressResult.isSuppressed) {
        ctx.result = suppressResult.result ?? 0;
        ctx.done = true;
        return;
      }
    }
  }
}

/**
 * Transactional execution phase: open the own transaction when needed, run DML +
 * skip-navigation writes, commit, invalidate caches, accept changes, run
 * `savedChanges`. On failure: rollback, run `saveChangesFailed`, and translate
 * `OptimisticConcurrencyError` to `DbUpdateConcurrencyException`.
 *
 * Preserves the original `saveChanges` try/catch byte-for-byte.
 */
export class TransactionalExecutionStep implements SaveStep {
  async execute(ctx: SaveContext, deps: SavePipelineDeps): Promise<void> {
    const ownTransaction = !deps.transactionScope.isActive;
    if (ownTransaction) {
      await deps.provider.beginTransaction();
    }
    try {
      let affectedRows = await deps.changeExecutor.executeChanges(ctx.changes);

      // Process many-to-many skip navigation join-row inserts/deletes
      const skipNavChanges = deps.changeTracker.collectSkipNavigationChanges();
      affectedRows += await deps.changeExecutor.applySkipNavigationChanges(skipNavChanges);

      if (ownTransaction) {
        await deps.provider.commitTransaction();
      }
      deps.cacheCoordinator.invalidateAfterMutation(ctx.normalizedForInvalidation);
      deps.changeTracker.acceptAllChanges();

      // savedChanges — interceptors may adjust the final row count
      let result = affectedRows;
      for (const ic of ctx.interceptors) {
        const r = await ic.savedChanges?.(ctx.eventData, result);
        if (r !== undefined) result = r;
      }
      ctx.result = result;
    } catch (error) {
      if (ownTransaction) {
        await deps.provider.rollbackTransaction();
      }
      // saveChangesFailed — notify interceptors of the failure
      for (const ic of ctx.interceptors) {
        await ic.saveChangesFailed?.(ctx.eventData, error as Error);
      }
      if (error instanceof OptimisticConcurrencyError) {
        const failedEntries = ctx.changes.map(
          (c) => new EntityEntry(c.entity, c.entityClass, deps.provider)
        );
        throw new DbUpdateConcurrencyException(error.message, failedEntries);
      }
      throw error;
    }
  }
}
