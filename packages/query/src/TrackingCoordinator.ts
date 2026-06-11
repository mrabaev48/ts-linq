import { QueryTrackingBehavior } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityAttacher } from '@ts-linq/types';

/**
 * Applies change-tracking / identity-resolution to a freshly materialized entity list.
 *
 * Stateless — a single instance is shared by reference across all clones of a `Queryable` chain.
 * The per-chain tracking mode and (optional) attacher are passed in by the facade, so this
 * collaborator never holds query state of its own.
 */
export class TrackingCoordinator {
  /**
   * Apply tracking / identity-resolution logic to a freshly materialized entity list.
   *
   * - `TrackAll` (+ attacher): attaches every entity to the change tracker.
   * - `NoTrackingWithIdentityResolution`: deduplicates by primary key.
   * - otherwise: returns the list unchanged.
   *
   * Keyless entities are always returned untouched.
   */
  apply<T>(
    entities: T[],
    entityClass: new () => T,
    trackingMode: QueryTrackingBehavior,
    attacher: EntityAttacher | undefined
  ): T[] {
    const meta = MetadataStorage.getEntity(entityClass);
    if (meta?.isKeyless) return entities;
    if (trackingMode === QueryTrackingBehavior.TrackAll && attacher) {
      for (const entity of entities) {
        attacher.attach(entity as object, entityClass);
      }
      return entities;
    }
    if (trackingMode === QueryTrackingBehavior.NoTrackingWithIdentityResolution) {
      return this.deduplicateByPk(entities, entityClass);
    }
    return entities;
  }

  /** Deduplicate entities with the same PK, returning the first-seen instance for duplicates. */
  private deduplicateByPk<T>(entities: T[], entityClass: new () => T): T[] {
    const metadata = MetadataStorage.getEntity(entityClass);
    const pkProp = metadata?.primaryKeys?.[0];
    if (!pkProp) return entities;
    const seen = new Map<unknown, T>();
    const result: T[] = [];
    for (const entity of entities) {
      const pk = (entity as Record<string, unknown>)[pkProp];
      if (pk !== undefined) {
        const existing = seen.get(pk);
        if (existing) {
          result.push(existing);
          continue;
        }
        seen.set(pk, entity);
      }
      result.push(entity);
    }
    return result;
  }
}
