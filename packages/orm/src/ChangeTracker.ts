import type { TrackedEntity } from '@ts-linq/core';
import { EntityState, QueryTrackingBehavior } from '@ts-linq/core';
import {
  defaultPropertyAccessor,
  type MetadataRegistry,
  MetadataStorage,
  type PropertyAccessor
} from '@ts-linq/metadata';
import type { EntityAttacher } from '@ts-linq/types';

import { CascadeWalker } from './changetracker/CascadeWalker';
import type { EntityEntryGraphNode, ITrackGraphEntry } from './changetracker/EntityEntryGraphNode';
import { GraphIterator } from './changetracker/GraphIterator';

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
  /** Shadow property values: entity → (propertyName → value). Parallel to _trackedEntities (P1-16). */
  private readonly _shadowValues: WeakMap<object, Map<string, unknown>> = new WeakMap();

  /** Default tracking behavior applied to all queries originating from this context. */
  public queryTrackingBehavior: QueryTrackingBehavior = QueryTrackingBehavior.TrackAll;

  /**
   * Controls whether `detectChanges()` is called automatically inside `saveChanges()`.
   * Default: true. Set to false for bulk-update scenarios and call `detectChanges()` manually.
   *
   * ⚠ If you set this to false and forget to call `detectChanges()` before `saveChanges()`,
   * property mutations on Unchanged entities will not be persisted.
   */
  public autoDetectChangesEnabled: boolean = true;

  /** Provider reference passed to EntityEntry nodes created by trackGraph. */
  private _provider: unknown = undefined;

  constructor(registry?: MetadataRegistry) {
    this._registry = registry ?? MetadataStorage.getInstance();
  }

  /** Called by DbContext to wire the provider into trackGraph's EntityEntry nodes. */
  public setProvider(provider: unknown): void {
    this._provider = provider;
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

  // ─── trackGraph / setState ───────────────────────────────────────────────

  /**
   * Walk a detached object graph starting at `root`, visiting each reachable
   * entity exactly once (BFS, cycle-safe). For each node the `callback` receives
   * an `EntityEntryGraphNode` whose `entry` exposes `state` and `isKeySet`.
   *
   * Mirrors EF Core's `ChangeTracker.TrackGraph(root, callback)`.
   *
   * @example
   * context.changeTracker.trackGraph(blog, Blog, node => {
   *   node.entry.state = node.entry.isKeySet
   *     ? EntityState.Modified
   *     : EntityState.Added;
   * });
   */
  public trackGraph(
    root: object,
    entityClass: Function,
    callback: (node: EntityEntryGraphNode) => void
  ): void {
    const nodeFactory = (
      entity: object,
      cls: Function,
      inboundNavigation: string | undefined
    ): EntityEntryGraphNode => {
      // Capture methods as closures so getters/setters don't need 'this' inside object literal.
      const getState = (): EntityState => this.getEntityState(entity);
      const setStateFn = (value: EntityState): void => this.setState(entity, cls, value);
      const getIsKeySet = (): boolean => {
        const meta = this._registry.getEntity(cls);
        const pk = meta?.primaryKeys?.[0];
        if (!pk) return false;
        const val = (entity as Record<string, unknown>)[pk];
        return val !== undefined && val !== null && val !== 0 && val !== '';
      };
      const entry: ITrackGraphEntry = {
        entity,
        entityClass: cls,
        get state() {
          return getState();
        },
        set state(value: EntityState) {
          setStateFn(value);
        },
        get isKeySet() {
          return getIsKeySet();
        }
      };
      return { entry, inboundNavigation };
    };
    const iterator = new GraphIterator(this._registry, nodeFactory);
    iterator.traverse(root, entityClass, callback);
  }

  /**
   * Directly set the tracking state of an already-tracked entity.
   * Used by `EntityEntry.state` setter and by `trackGraph` callbacks.
   */
  public setState(entity: object, entityClass: Function, state: EntityState): void {
    let tracked = this._trackedEntities.get(entity) ?? this.findByPk(entity, entityClass);
    if (tracked) {
      tracked.state = state;
      return;
    }
    tracked = {
      entity,
      entityClass,
      state,
      originalValues:
        state === EntityState.Modified || state === EntityState.Unchanged
          ? this.cloneObject(entity, entityClass)
          : undefined
    };
    this._trackedEntities.set(entity, tracked);
    this.registerInPkMap(tracked);
  }

  // ─── Shadow property API (P1-16) ─────────────────────────────────────────

  /** Read a shadow property value for a tracked entity. */
  public getShadowValue(entity: object, name: string): unknown {
    return this._shadowValues.get(entity)?.get(name);
  }

  /** Write a shadow property value for a tracked entity. */
  public setShadowValue(entity: object, name: string, value: unknown): void {
    let map = this._shadowValues.get(entity);
    if (!map) {
      map = new Map();
      this._shadowValues.set(entity, map);
    }
    map.set(name, value);
  }

  /** Collect all shadow values for a tracked entity (used during persistence). */
  public getShadowValues(entity: object): Map<string, unknown> | undefined {
    return this._shadowValues.get(entity);
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
        if (
          this.hasChanged(tracked.entity, tracked.originalValues, tracked.entityClass) ||
          this.hasShadowChanged(tracked.entity, tracked.entityClass)
        ) {
          tracked.state = EntityState.Modified;
        }
      }
    }
  }

  private hasShadowChanged(entity: object, entityClass: Function): boolean {
    const meta = this._registry.getEntity(entityClass);
    if (!meta?.shadowProperties) return false;
    const shadowValues = this._shadowValues.get(entity);
    if (!shadowValues) return false;
    // Any shadow value set after attach counts as a change
    return shadowValues.size > 0;
  }

  private hasChanged(entity: object, original: object, entityClass: Function): boolean {
    const meta = this._registry.getEntity(entityClass);
    if (!meta) return !this.areObjectsEqual(entity, original);

    for (const col of meta.columns) {
      const accessor =
        (col.accessor as PropertyAccessor | undefined) ?? defaultPropertyAccessor(col.propertyName);
      const current = accessor.get(entity);
      // Original snapshot was cloned from the entity; use the same accessor to read it.
      const prev = accessor.get(original);
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
      // structuredClone copies all enumerable own properties, including _underscored backing fields.
      const cloned = this.baseClone(obj);
      for (const col of meta.columns) {
        if (col.comparer) {
          const accessor =
            (col.accessor as PropertyAccessor | undefined) ??
            defaultPropertyAccessor(col.propertyName);
          const val = accessor.get(obj as object);
          if (val !== undefined && val !== null) {
            // Write the snapshot value back via the same accessor so it lands in the right key.
            accessor.set(cloned as object, col.comparer.snapshot(val));
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
