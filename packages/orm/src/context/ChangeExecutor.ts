import type { EntityCtorRef } from '@ts-linq/types';

import { type JoinRowChange } from '../ChangeTracker';
import { BatchExecutor } from '../save-changes/batch-executor';
import type { NormalizedChange } from '../types';
import type { DbContextServices } from './DbContextServices';

/** Raw tracked change as produced by the change tracker. */
type TrackedChange = {
  entity: object;
  entityClass: EntityCtorRef;
  state: string;
  originalValues?: object;
};

/**
 * Owns persistence of tracked changes: batch-vs-SP-vs-per-row routing, per-row
 * DML dispatch (`processChange`), entity-splitting fragment writes (`apply*`),
 * shadow-property normalization, and many-to-many skip-navigation join writes.
 * Depends only on the built commands/executors via {@link DbContextServices}.
 *
 * @internal
 */
export class ChangeExecutor {
  constructor(private readonly services: DbContextServices) {}

  /**
   * Persist all primary-table changes, routing through the batch executor,
   * stored procedures, or per-row commands as configured. Returns the number of
   * affected rows.
   */
  async executeChanges(changes: ReadonlyArray<TrackedChange>): Promise<number> {
    let affectedRows = 0;
    if (this.services.maxBatchSize > 0) {
      const allNormalized = changes.map((c) => this.normalizeChange(c));
      const spChanges: typeof allNormalized = [];
      const dmlChanges: typeof allNormalized = [];
      for (const c of allNormalized) {
        const op = c.state === 'added' ? 'insert' : c.state === 'modified' ? 'update' : 'delete';
        if (this.services.spExecutor.hasSp(c.entityClass, op as 'insert' | 'update' | 'delete')) {
          spChanges.push(c);
        } else {
          dmlChanges.push(c);
        }
      }
      for (const c of spChanges) {
        affectedRows += await this.processChange(c);
      }
      if (dmlChanges.length > 0) {
        const batchExecutor = new BatchExecutor(
          this.services.provider,
          this.services.maxBatchSize,
          this.services.registry
        );
        affectedRows += await batchExecutor.execute(dmlChanges);
      }
    } else {
      for (const change of changes) {
        const normalized = this.normalizeChange(change);
        affectedRows += await this.processChange(normalized);
      }
    }
    return affectedRows;
  }

  /** Process many-to-many skip navigation join-row inserts/deletes. */
  async applySkipNavigationChanges(changes: JoinRowChange[]): Promise<number> {
    let count = 0;
    for (const change of changes) {
      if (change.operation === 'insert') {
        await this.services.provider.insert(change.joinRow, change.joinEntityCtor);
      } else {
        await this.services.provider.delete(change.joinRow, change.joinEntityCtor);
      }
      count++;
    }
    return count;
  }

  private normalizeChange(change: TrackedChange): NormalizedChange {
    const shadowValues = this.services.changeTracker.getShadowValues(change.entity);
    const entity =
      shadowValues && shadowValues.size > 0
        ? { ...(change.entity as Record<string, unknown>), ...Object.fromEntries(shadowValues) }
        : (change.entity as Record<string, unknown>);

    return {
      entity,
      entityClass: change.entityClass,
      state: change.state,
      originalValues: change.originalValues
    };
  }

  private async processChange(change: NormalizedChange): Promise<number> {
    switch (change.state) {
      case 'added':
        if (this.services.spExecutor.hasSp(change.entityClass, 'insert')) {
          await this.services.spExecutor.executeInsert(change.entity, change.entityClass);
          return 1;
        }
        await this.applyInsert(change);
        return 1;
      case 'modified':
        if (this.services.spExecutor.hasSp(change.entityClass, 'update')) {
          return await this.services.spExecutor.executeUpdate(
            change.entity,
            change.originalValues as Record<string, unknown> | undefined,
            change.entityClass
          );
        }
        await this.applyUpdate(change);
        return 1;
      case 'deleted':
        if (this.services.spExecutor.hasSp(change.entityClass, 'delete')) {
          return await this.services.spExecutor.executeDelete(
            change.entity,
            change.originalValues as Record<string, unknown> | undefined,
            change.entityClass
          );
        }
        return (await this.applyDelete(change)) ? 1 : 0;
      default:
        return 0;
    }
  }

  private async applyInsert(
    change: Pick<NormalizedChange, 'entity' | 'entityClass'>
  ): Promise<void> {
    // Primary table insert (normal path).
    await this.services.insertCmd.execute({ ...change, state: 'added' });

    // Entity splitting: insert into each secondary fragment table.
    const meta = this.services.registry.getEntity(change.entityClass);
    if (meta?.tableFragments?.length) {
      for (const fragment of meta.tableFragments) {
        await this.services.fragmentExecutor.insertFragment(change.entity, meta, fragment);
      }
    }
  }

  private async applyUpdate(
    change: Pick<NormalizedChange, 'entity' | 'entityClass' | 'originalValues'>
  ): Promise<void> {
    // Primary table update (normal path).
    await this.services.updateCmd.execute({ ...change, state: 'modified' });

    // Entity splitting: update each secondary fragment table.
    const meta = this.services.registry.getEntity(change.entityClass);
    if (meta?.tableFragments?.length) {
      for (const fragment of meta.tableFragments) {
        await this.services.fragmentExecutor.updateFragment(
          change.entity,
          meta,
          fragment,
          change.originalValues
        );
      }
    }
  }

  private async applyDelete(
    change: Pick<NormalizedChange, 'entity' | 'entityClass' | 'originalValues'>
  ): Promise<boolean> {
    // Entity splitting: delete from secondary fragments first (reverse order) before primary.
    const meta = this.services.registry.getEntity(change.entityClass);
    if (meta?.tableFragments?.length) {
      for (const fragment of [...meta.tableFragments].reverse()) {
        await this.services.fragmentExecutor.deleteFragment(
          change.entity,
          meta,
          fragment,
          change.originalValues
        );
      }
    }

    return await this.services.deleteCmd.execute({ ...change, state: 'deleted' });
  }
}
