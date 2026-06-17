import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

/** A single many-to-many join-row mutation produced by `DbContext.saveChanges()`. */
export interface JoinRowChange {
  joinRow: Record<string, unknown>;
  joinEntityCtor: EntityCtorRef;
  operation: 'insert' | 'delete';
}

/**
 * Tracks many-to-many (skip-navigation) collections by snapshotting their target
 * PKs at attach time and diffing them at save time. Extracted from `ChangeTracker`
 * (refactor task-4); owns the `entity → (propName → Set<pk>)` snapshot map.
 */
export class SkipNavigationTracker {
  /** Snapshots of skip-navigation collection PKs at attach time. */
  private readonly snapshots: Map<object, Map<string, Set<unknown>>> = new Map();

  constructor(private readonly registry: MetadataRegistry) {}

  /** Capture (or refresh) the skip-navigation collection snapshot for an entity. */
  snapshot(entity: object, entityClass: EntityCtorRef): void {
    this.snapshots.set(entity, this.computeSnapshot(entity, entityClass));
  }

  /** Drop the snapshot for an entity that is no longer tracked. */
  forget(entity: object): void {
    this.snapshots.delete(entity);
  }

  /** Drop all snapshots. */
  clear(): void {
    this.snapshots.clear();
  }

  private computeSnapshot(entity: object, entityClass: EntityCtorRef): Map<string, Set<unknown>> {
    const result = new Map<string, Set<unknown>>();
    const meta = this.registry.getEntity(entityClass);
    if (!meta?.skipNavigations?.length) return result;

    const rec = entity as Record<string, unknown>;
    for (const sn of meta.skipNavigations) {
      const collection = rec[sn.propertyName];
      if (!Array.isArray(collection)) continue;

      const targetMeta = this.registry.getEntity(sn.targetEntity);
      const targetPk = targetMeta?.primaryKeys?.[0];
      const pks = new Set<unknown>();
      for (const item of collection) {
        const pkVal = targetPk ? (item as Record<string, unknown>)[targetPk] : undefined;
        if (pkVal !== undefined && pkVal !== null) pks.add(pkVal);
      }
      result.set(sn.propertyName, pks);
    }
    return result;
  }

  /**
   * Compares current many-to-many collections against their snapshots and returns
   * the join-row inserts/deletes needed by `DbContext.saveChanges()`.
   */
  collectChanges(tracked: Iterable<TrackedEntity>): JoinRowChange[] {
    const changes: JoinRowChange[] = [];

    for (const t of tracked) {
      // Skip deleted entities — removing the entity removes join rows via cascade or explicit delete.
      if (t.state === EntityState.Deleted) continue;

      const meta = this.registry.getEntity(t.entityClass);
      if (!meta?.skipNavigations?.length) continue;

      const snapshot = this.snapshots.get(t.entity);
      const rec = t.entity as Record<string, unknown>;
      const ownerPk = meta.primaryKeys?.[0];
      const ownerPkVal = ownerPk ? rec[ownerPk] : undefined;
      if (ownerPkVal === undefined || ownerPkVal === null) continue;

      for (const sn of meta.skipNavigations) {
        const current = rec[sn.propertyName];
        if (!Array.isArray(current)) continue;

        const targetMeta = this.registry.getEntity(sn.targetEntity);
        const targetPk = targetMeta?.primaryKeys?.[0];

        const currentPks = new Set<unknown>();
        for (const item of current) {
          const pkVal = targetPk ? (item as Record<string, unknown>)[targetPk] : undefined;
          if (pkVal !== undefined && pkVal !== null) {
            currentPks.add(pkVal);
          }
        }

        const originalPks = snapshot?.get(sn.propertyName) ?? new Set<unknown>();

        // Added items
        for (const pk of currentPks) {
          if (!originalPks.has(pk)) {
            changes.push({
              joinRow: { [sn.leftForeignKey]: ownerPkVal, [sn.rightForeignKey]: pk },
              joinEntityCtor: sn.joinEntityCtor,
              operation: 'insert'
            });
          }
        }

        // Removed items
        for (const pk of originalPks) {
          if (!currentPks.has(pk)) {
            changes.push({
              joinRow: { [sn.leftForeignKey]: ownerPkVal, [sn.rightForeignKey]: pk },
              joinEntityCtor: sn.joinEntityCtor,
              operation: 'delete'
            });
          }
        }
      }
    }

    return changes;
  }
}
