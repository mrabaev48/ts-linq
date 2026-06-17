import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';

import { pkTupleFromEntity, pkTupleFromValues } from './pkKey';

/**
 * Identity map for the change tracker: indexes tracked entities by primary-key
 * tuple so a second lookup for the same row resolves to the same `TrackedEntity`.
 * Extracted from `ChangeTracker` (refactor task-4); composite-PK keying lives in
 * the shared {@link pkTupleFromEntity} helper, not duplicated here.
 */
export class TrackedIdentityMap {
  private readonly byPk: Map<EntityCtorRef, Map<string, TrackedEntity>> = new Map();

  constructor(private readonly registry: MetadataRegistry) {}

  private mapFor(entityClass: EntityCtorRef): Map<string, TrackedEntity> {
    let map = this.byPk.get(entityClass);
    if (!map) {
      map = new Map();
      this.byPk.set(entityClass, map);
    }
    return map;
  }

  /** Index a tracked entity by its PK tuple (no-op when the PK is unset). */
  register(tracked: TrackedEntity): void {
    const key = pkTupleFromEntity(tracked.entity, tracked.entityClass, this.registry);
    if (key !== undefined) {
      this.mapFor(tracked.entityClass).set(key, tracked);
    }
  }

  /** Remove a tracked entity from the PK index (no-op when the PK is unset). */
  unregister(tracked: TrackedEntity): void {
    const key = pkTupleFromEntity(tracked.entity, tracked.entityClass, this.registry);
    if (key !== undefined) {
      this.byPk.get(tracked.entityClass)?.delete(key);
    }
  }

  /** Return the tracked entity sharing the same PK as `entity`, if any. */
  findByPk(entity: object, entityClass: EntityCtorRef): TrackedEntity | undefined {
    const key = pkTupleFromEntity(entity, entityClass, this.registry);
    if (key === undefined) return undefined;
    return this.byPk.get(entityClass)?.get(key);
  }

  /** Look up a tracked entity by raw PK value(s) (alphabetical PK-name order). */
  findByValues(
    entityClass: EntityCtorRef,
    pkValues: readonly unknown[]
  ): TrackedEntity | undefined {
    const key = pkTupleFromValues(entityClass, pkValues, this.registry);
    if (key === undefined) return undefined;
    return this.byPk.get(entityClass)?.get(key);
  }

  clear(): void {
    this.byPk.clear();
  }
}
