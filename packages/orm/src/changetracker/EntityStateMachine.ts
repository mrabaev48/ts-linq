import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import type { ITrackedEntityObserver } from './ITrackedEntityObserver';
import type { SkipNavigationTracker } from './SkipNavigationTracker';
import type { SnapshotStore } from './SnapshotStore';
import type { TrackedIdentityMap } from './TrackedIdentityMap';

/**
 * Unit-of-work state machine: owns the reference-keyed tracked-entity map and the
 * `Added/Modified/Deleted/Unchanged` transitions. Extracted from `ChangeTracker`
 * (refactor task-4).
 *
 * Collaborators are injected: the {@link TrackedIdentityMap} for PK indexing, the
 * {@link SnapshotStore} for `originalValues`, the {@link SkipNavigationTracker} for
 * m2m collection snapshots, and an {@link ITrackedEntityObserver} that the machine
 * emits transitions to (instead of hard-wiring `LocalView`).
 */
export class EntityStateMachine {
  private readonly tracked: Map<object, TrackedEntity> = new Map();

  constructor(
    private readonly identityMap: TrackedIdentityMap,
    private readonly snapshots: SnapshotStore,
    private readonly skipNav: SkipNavigationTracker,
    private readonly observer: ITrackedEntityObserver
  ) {}

  /** Live view of all tracked entities (used by detection / diffing / views). */
  all(): Map<object, TrackedEntity> {
    return this.tracked;
  }

  /** Track an entity as Added (dedup by object reference only). */
  add(entity: object, entityClass: EntityCtorRef): void {
    const existing = this.tracked.get(entity);
    if (existing) {
      existing.state = EntityState.Added;
      this.observer.onTracked(existing, 'modified');
      return;
    }
    const tracked: TrackedEntity = { entity, entityClass, state: EntityState.Added };
    this.tracked.set(entity, tracked);
    this.identityMap.register(tracked);
    this.observer.onTracked(tracked, 'added');
  }

  /** Track an entity as Modified (reuses an existing reference/PK match in place). */
  update(entity: object, entityClass: EntityCtorRef): void {
    const existing = this.tracked.get(entity) ?? this.identityMap.findByPk(entity, entityClass);
    if (existing) {
      existing.state = EntityState.Modified;
      this.observer.onTracked(existing, 'modified');
      return;
    }
    const tracked: TrackedEntity = {
      entity,
      entityClass,
      state: EntityState.Modified,
      originalValues: this.snapshots.clone(entity, entityClass)
    };
    this.tracked.set(entity, tracked);
    this.identityMap.register(tracked);
    this.observer.onTracked(tracked, 'added');
  }

  /** Track an entity as Deleted (reuses an existing reference/PK match in place). */
  remove(entity: object, entityClass: EntityCtorRef): void {
    const existing = this.tracked.get(entity) ?? this.identityMap.findByPk(entity, entityClass);
    if (existing) {
      existing.state = EntityState.Deleted;
      this.observer.onTracked(existing, 'removed');
      return;
    }
    const tracked: TrackedEntity = { entity, entityClass, state: EntityState.Deleted };
    this.tracked.set(entity, tracked);
    this.identityMap.register(tracked);
    // Deleted entities are not visible in LocalView — no 'added' notification.
  }

  /** Track an entity as Unchanged (Identity Map: one reference per PK per context). */
  attach(entity: object, entityClass: EntityCtorRef): void {
    const existing = this.identityMap.findByPk(entity, entityClass);
    if (existing) {
      existing.state = EntityState.Unchanged;
      existing.originalValues = this.snapshots.clone(existing.entity, entityClass);
      this.skipNav.snapshot(entity, entityClass);
      this.observer.onTracked(existing, 'modified');
      return;
    }
    const tracked: TrackedEntity = {
      entity,
      entityClass,
      state: EntityState.Unchanged,
      originalValues: this.snapshots.clone(entity, entityClass)
    };
    this.tracked.set(entity, tracked);
    this.identityMap.register(tracked);
    this.skipNav.snapshot(entity, entityClass);
    this.observer.onTracked(tracked, 'added');
  }

  /** Directly set the tracking state of an entity (used by EntityEntry / trackGraph). */
  setState(entity: object, entityClass: EntityCtorRef, state: EntityState): void {
    let tracked = this.tracked.get(entity) ?? this.identityMap.findByPk(entity, entityClass);
    if (tracked) {
      tracked.state = state;
      this.observer.onTracked(tracked, state === EntityState.Deleted ? 'removed' : 'modified');
      return;
    }
    tracked = {
      entity,
      entityClass,
      state,
      originalValues:
        state === EntityState.Modified || state === EntityState.Unchanged
          ? this.snapshots.clone(entity, entityClass)
          : undefined
    };
    this.tracked.set(entity, tracked);
    this.identityMap.register(tracked);
    if (state !== EntityState.Deleted) {
      this.observer.onTracked(tracked, 'added');
    }
  }

  /** Return all tracked entities that have pending changes. */
  getChanges(): TrackedEntity[] {
    return Array.from(this.tracked.values()).filter((t) => t.state !== EntityState.Unchanged);
  }

  /** Return the current tracking state for a specific entity reference. */
  getEntityState(entity: object): EntityState {
    return this.tracked.get(entity)?.state ?? EntityState.Unchanged;
  }

  /** Accept all changes: deleted entries are removed, others reset to Unchanged. */
  acceptAllChanges(): void {
    for (const tracked of Array.from(this.tracked.values())) {
      if (tracked.state === EntityState.Deleted) {
        this.tracked.delete(tracked.entity);
        this.skipNav.forget(tracked.entity);
        this.identityMap.unregister(tracked);
      } else {
        tracked.state = EntityState.Unchanged;
        tracked.originalValues = this.snapshots.clone(tracked.entity, tracked.entityClass);
        this.skipNav.snapshot(tracked.entity, tracked.entityClass);
      }
    }
    // Re-sync all LocalViews to remove deleted entries that were purged above.
    this.observer.onSync(this.tracked);
  }

  /** Clear all tracked entities and identity index. */
  clear(): void {
    this.tracked.clear();
    this.identityMap.clear();
    this.skipNav.clear();
    this.observer.onSync(this.tracked);
  }

  /** Return all tracked records for a given entity class. */
  getTrackedForType(entityClass: EntityCtorRef): TrackedEntity[] {
    const result: TrackedEntity[] = [];
    for (const tracked of this.tracked.values()) {
      if (tracked.entityClass === entityClass) result.push(tracked);
    }
    return result;
  }

  /** Look up a raw tracked record by PK value(s). */
  findByValues(
    entityClass: EntityCtorRef,
    pkValues: readonly unknown[]
  ): TrackedEntity | undefined {
    return this.identityMap.findByValues(entityClass, pkValues);
  }
}
