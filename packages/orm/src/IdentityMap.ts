import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

/**
 * Lightweight per-query identity map for NoTrackingWithIdentityResolution mode.
 * Deduplicates entity instances by primary key without attaching them to the ChangeTracker.
 */
export class IdentityMap {
  private readonly _map = new Map<EntityCtorRef, Map<unknown, object>>();

  resolve<T extends object>(entity: T, entityClass: new () => T): T {
    const metadata = MetadataStorage.getEntity(entityClass);
    const pkProp = metadata?.primaryKeys?.[0];
    if (!pkProp) return entity;
    const pk = (entity as Record<string, unknown>)[pkProp];
    if (pk === undefined) return entity;
    let classMap = this._map.get(entityClass);
    if (!classMap) {
      classMap = new Map();
      this._map.set(entityClass, classMap);
    }
    const existing = classMap.get(pk);
    if (existing) return existing as T;
    classMap.set(pk, entity);
    return entity;
  }

  clear(): void {
    this._map.clear();
  }
}
