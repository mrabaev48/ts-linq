import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

import { pkTupleFromEntity } from './changetracker/pkKey';

/**
 * Lightweight per-query identity map for NoTrackingWithIdentityResolution mode.
 * Deduplicates entity instances by primary key without attaching them to the ChangeTracker.
 *
 * Primary-key keying is delegated to the shared {@link pkTupleFromEntity} helper —
 * the same one the change tracker's `TrackedIdentityMap` uses — so composite-PK
 * keying lives in exactly one place (refactor task-4). Entities whose PK is unset
 * (any component `undefined`/`null`) are returned as-is, never deduplicated.
 */
export class IdentityMap {
  private readonly _map = new Map<EntityCtorRef, Map<string, object>>();

  resolve<T extends object>(entity: T, entityClass: new () => T): T {
    const key = pkTupleFromEntity(entity, entityClass, MetadataStorage.getInstance());
    if (key === undefined) return entity;
    let classMap = this._map.get(entityClass);
    if (!classMap) {
      classMap = new Map();
      this._map.set(entityClass, classMap);
    }
    const existing = classMap.get(key);
    if (existing) return existing as T;
    classMap.set(key, entity);
    return entity;
  }

  clear(): void {
    this._map.clear();
  }
}
