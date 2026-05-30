import type { TrackedEntity } from '@ts-linq/core';
import { EntityState, QueryTrackingBehavior } from '@ts-linq/core';
import { type MetadataRegistry, MetadataStorage } from '@ts-linq/metadata';
import type { EntityAttacher } from '@ts-linq/types';

import { CascadeWalker } from './changetracker/CascadeWalker';

/**
 * Tracks entities and their states (Added, Modified, Deleted, Unchanged)
 * to enable unit-of-work style persistence via `saveChanges`.
 *
 * Key improvements over the naïve reference-keyed implementation:
 *  - Identity Map: deduplicates entities with the same primary key so a
 *    second `find(id)` for the same row doesn't produce two UPDATE statements.
 *  - structuredClone: handles Date, BigInt, Map, Set, ArrayBuffer correctly
 *    when storing `originalValues` (falls back to JSON for Node < 17).
 *  - Deterministic equality: recursive deep-equal that handles key order and
 *    Date comparison, eliminating JSON.stringify ordering surprises.
 *  - Auto-detectChanges: `detectChanges()` is called automatically by
 *    DbContext.saveChanges() so property mutations are picked up without an
 *    explicit `update()` call.
 */
export interface JoinRowChange {
  joinRow: Record<string, unknown>;
  joinEntityCtor: Function;
  operation: 'insert' | 'delete';
}

export class ChangeTracker implements EntityAttacher {
  private _trackedEntities: Map<object, TrackedEntity> = new Map();
  /** Identity map: entityClass → (pkValue → TrackedEntity) */
  private _trackedByPk: Map<Function, Map<unknown, TrackedEntity>> = new Map();
  private readonly _registry: MetadataRegistry;
  /** Snapshots of skip-navigation collection PKs at attach time: entity → (propName → Set<pk>) */
  private _collectionSnapshots: Map<object, Map<string, Set<unknown>>> = new Map();

  /** Default tracking behavior applied to all queries originating from this context. */
  public queryTrackingBehavior: QueryTrackingBehavior = QueryTrackingBehavior.TrackAll;

  constructor(registry?: MetadataRegistry) {
    this._registry = registry ?? MetadataStorage.getInstance();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private getPkValue(entity: object, entityClass: Function): unknown {
    const meta = this._registry.getEntity(entityClass);
    const pk = meta?.primaryKeys?.[0];
    return pk !== undefined ? (entity as Record<string, unknown>)[pk] : undefined;
  }

  private getPkMap(entityClass: Function): Map<unknown, TrackedEntity> {
    let map = this._trackedByPk.get(entityClass);
    if (!map) {
      map = new Map();
      this._trackedByPk.set(entityClass, map);
    }
    return map;
  }

  /** Return existing TrackedEntity if the same PK is already tracked. */
  private findByPk(entity: object, entityClass: Function): TrackedEntity | undefined {
    const pk = this.getPkValue(entity, entityClass);
    if (pk === undefined) return undefined;
    return this.getPkMap(entityClass).get(pk);
  }

  private registerInPkMap(tracked: TrackedEntity): void {
    const pk = this.getPkValue(tracked.entity, tracked.entityClass);
    if (pk !== undefined) {
      this.getPkMap(tracked.entityClass).set(pk, tracked);
    }
  }

  private unregisterFromPkMap(tracked: TrackedEntity): void {
    const pk = this.getPkValue(tracked.entity, tracked.entityClass);
    if (pk !== undefined) {
      const map = this._trackedByPk.get(tracked.entityClass);
      if (map) map.delete(pk);
    }
  }

  // ─── Public tracking API ─────────────────────────────────────────────────

  /**
   * Track an entity as Added.
   * Deduplicates by object reference only — two different objects with the same
   * PK are both tracked (the database will enforce uniqueness at persist time).
   */
  public add<T extends object>(entity: T, entityClass: Function): void {
    const existing = this._trackedEntities.get(entity);
    if (existing) {
      existing.state = EntityState.Added;
      return;
    }
    const tracked: TrackedEntity = { entity, entityClass, state: EntityState.Added };
    this._trackedEntities.set(entity, tracked);
    this.registerInPkMap(tracked);
  }

  /**
   * Track an entity as Modified.
   * If an entity with the same PK is already tracked, updates its state in place.
   */
  public update<T extends object>(entity: T, entityClass: Function): void {
    const existing = this._trackedEntities.get(entity) ?? this.findByPk(entity, entityClass);
    if (existing) {
      existing.state = EntityState.Modified;
      return;
    }
    const tracked: TrackedEntity = {
      entity,
      entityClass,
      state: EntityState.Modified,
      originalValues: this.cloneObject(entity, entityClass)
    };
    this._trackedEntities.set(entity, tracked);
    this.registerInPkMap(tracked);
  }

  /**
   * Track an entity as Deleted.
   * If an entity with the same PK is already tracked, updates its state in place.
   */
  public remove<T extends object>(entity: T, entityClass: Function): void {
    const existing = this._trackedEntities.get(entity) ?? this.findByPk(entity, entityClass);
    if (existing) {
      existing.state = EntityState.Deleted;
      return;
    }
    const tracked: TrackedEntity = { entity, entityClass, state: EntityState.Deleted };
    this._trackedEntities.set(entity, tracked);
    this.registerInPkMap(tracked);
  }

  /**
   * Track an entity as Unchanged (loaded from database).
   * If an entity with the same PK is already tracked, the existing instance is reused
   * (Identity Map guarantee: one reference per PK per context).
   */
  public attach<T extends object>(entity: T, entityClass: Function): void {
    const existing = this.findByPk(entity, entityClass);
    if (existing) {
      existing.state = EntityState.Unchanged;
      existing.originalValues = this.cloneObject(existing.entity, entityClass);
      this._collectionSnapshots.set(entity, this._snapshotCollections(entity, entityClass));
      return;
    }
    const tracked: TrackedEntity = {
      entity,
      entityClass,
      state: EntityState.Unchanged,
      originalValues: this.cloneObject(entity, entityClass)
    };
    this._trackedEntities.set(entity, tracked);
    this.registerInPkMap(tracked);
    this._collectionSnapshots.set(entity, this._snapshotCollections(entity, entityClass));
  }

  /**
   * Apply client-side cascade delete behaviors for all currently-deleted tracked entities.
   * Must be called after detectChanges() and before getChanges() in the saveChanges pipeline.
   */
  public applyCascades(): void {
    const walker = new CascadeWalker(this._registry);
    walker.walk(this._trackedEntities);
  }

  /** Return all tracked entities that have pending changes. */
  public getChanges(): TrackedEntity[] {
    return Array.from(this._trackedEntities.values()).filter(
      (tracked) => tracked.state !== EntityState.Unchanged
    );
  }

  /** Return the current tracking state for a specific entity reference. */
  public getEntityState(entity: object): EntityState {
    const tracked = this._trackedEntities.get(entity);
    return tracked ? tracked.state : EntityState.Unchanged;
  }

  /** Accept all changes: deleted entries are removed, others reset to Unchanged. */
  public acceptAllChanges(): void {
    for (const tracked of Array.from(this._trackedEntities.values())) {
      if (tracked.state === EntityState.Deleted) {
        this._trackedEntities.delete(tracked.entity);
        this._collectionSnapshots.delete(tracked.entity);
        this.unregisterFromPkMap(tracked);
      } else {
        tracked.state = EntityState.Unchanged;
        tracked.originalValues = this.cloneObject(tracked.entity, tracked.entityClass);
        this._collectionSnapshots.set(
          tracked.entity,
          this._snapshotCollections(tracked.entity, tracked.entityClass)
        );
      }
    }
  }

  /** Clear all tracked entities from both maps. */
  public clear(): void {
    this._trackedEntities.clear();
    this._trackedByPk.clear();
    this._collectionSnapshots.clear();
  }

  /**
   * Scan all Unchanged tracked entities and mark them Modified when their
   * current state differs from the stored `originalValues`.
   * Called automatically by `DbContext.saveChanges()`.
   * Uses ValueComparer.equals for properties that have a comparer configured.
   */
  public detectChanges(): void {
    for (const tracked of this._trackedEntities.values()) {
      if (tracked.state === EntityState.Unchanged && tracked.originalValues) {
        if (this.hasChanged(tracked.entity, tracked.originalValues, tracked.entityClass)) {
          tracked.state = EntityState.Modified;
        }
      }
    }
  }

  private hasChanged(entity: object, original: object, entityClass: Function): boolean {
    const meta = this._registry.getEntity(entityClass);
    if (!meta) return !this.areObjectsEqual(entity, original);

    const rec = entity as Record<string, unknown>;
    const orig = original as Record<string, unknown>;

    for (const col of meta.columns) {
      const current = rec[col.propertyName];
      const prev = orig[col.propertyName];
      if (col.comparer) {
        if (!col.comparer.equals(current, prev)) return true;
      } else {
        if (!this.areObjectsEqual(current, prev)) return true;
      }
    }
    return false;
  }

  // ─── Skip navigation (many-to-many) collection tracking ─────────────────

  private _snapshotCollections(entity: object, entityClass: Function): Map<string, Set<unknown>> {
    const result = new Map<string, Set<unknown>>();
    const meta = this._registry.getEntity(entityClass);
    if (!meta?.skipNavigations?.length) return result;

    const rec = entity as Record<string, unknown>;
    for (const sn of meta.skipNavigations) {
      const collection = rec[sn.propertyName];
      if (!Array.isArray(collection)) continue;

      const targetMeta = this._registry.getEntity(sn.targetEntity);
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
   * Compares current many-to-many collections against their snapshots and
   * returns the join-row inserts/deletes needed by `DbContext.saveChanges()`.
   */
  public collectSkipNavigationChanges(): JoinRowChange[] {
    const changes: JoinRowChange[] = [];

    for (const tracked of this._trackedEntities.values()) {
      // Skip deleted entities — removing the entity removes join rows via cascade or explicit delete
      if (tracked.state === EntityState.Deleted) continue;

      const meta = this._registry.getEntity(tracked.entityClass);
      if (!meta?.skipNavigations?.length) continue;

      const snapshot = this._collectionSnapshots.get(tracked.entity);
      const rec = tracked.entity as Record<string, unknown>;
      const ownerMeta = meta;
      const ownerPk = ownerMeta.primaryKeys?.[0];
      const ownerPkVal = ownerPk ? rec[ownerPk] : undefined;
      if (ownerPkVal === undefined || ownerPkVal === null) continue;

      for (const sn of meta.skipNavigations) {
        const current = rec[sn.propertyName];
        if (!Array.isArray(current)) continue;

        const targetMeta = this._registry.getEntity(sn.targetEntity);
        const targetPk = targetMeta?.primaryKeys?.[0];

        const currentPks = new Set<unknown>();
        const currentItemsByPk = new Map<unknown, unknown>();
        for (const item of current) {
          const pkVal = targetPk ? (item as Record<string, unknown>)[targetPk] : undefined;
          if (pkVal !== undefined && pkVal !== null) {
            currentPks.add(pkVal);
            currentItemsByPk.set(pkVal, pkVal);
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

  // ─── Cloning & equality ───────────────────────────────────────────────────

  private cloneObject<T>(obj: T, entityClass?: Function): T {
    const meta = entityClass ? this._registry.getEntity(entityClass) : undefined;
    if (meta) {
      // Use comparer.snapshot for columns that have one, structuredClone for the rest
      const cloned = this.baseClone(obj);
      const rec = cloned as Record<string, unknown>;
      for (const col of meta.columns) {
        if (col.comparer) {
          const val = (obj as Record<string, unknown>)[col.propertyName];
          if (val !== undefined && val !== null) {
            rec[col.propertyName] = col.comparer.snapshot(val);
          }
        }
      }
      return cloned;
    }
    return this.baseClone(obj);
  }

  private baseClone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    // Fallback for Node.js < 17
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  /**
   * Recursive deep-equal that correctly handles:
   * - Object reference identity
   * - Date objects (compared by .getTime())
   * - Arrays (element-by-element)
   * - Plain objects (sorted keys to eliminate key-order sensitivity)
   * - Primitives
   */
  private areObjectsEqual<T>(a: T, b: T): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => this.areObjectsEqual(v, b[i]));
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const ka = Object.keys(a).sort();
      const kb = Object.keys(b).sort();
      if (ka.join('\x00') !== kb.join('\x00')) return false;
      return ka.every((k) =>
        this.areObjectsEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      );
    }
    return false;
  }
}
