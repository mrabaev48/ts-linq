import type { TrackedEntity } from '@ts-linq/core';
import { EntityState } from '@ts-linq/core';
import { MetadataStorage, type MetadataRegistry } from '@ts-linq/metadata';

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
export class ChangeTracker {
  private _trackedEntities: Map<object, TrackedEntity> = new Map();
  /** Identity map: entityClass → (pkValue → TrackedEntity) */
  private _trackedByPk: Map<Function, Map<unknown, TrackedEntity>> = new Map();
  private readonly _registry: MetadataRegistry;

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
      originalValues: this.cloneObject(entity)
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
      existing.originalValues = this.cloneObject(existing.entity);
      return;
    }
    const tracked: TrackedEntity = {
      entity,
      entityClass,
      state: EntityState.Unchanged,
      originalValues: this.cloneObject(entity)
    };
    this._trackedEntities.set(entity, tracked);
    this.registerInPkMap(tracked);
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
        this.unregisterFromPkMap(tracked);
      } else {
        tracked.state = EntityState.Unchanged;
        tracked.originalValues = this.cloneObject(tracked.entity);
      }
    }
  }

  /** Clear all tracked entities from both maps. */
  public clear(): void {
    this._trackedEntities.clear();
    this._trackedByPk.clear();
  }

  /**
   * Scan all Unchanged tracked entities and mark them Modified when their
   * current state differs from the stored `originalValues`.
   * Called automatically by `DbContext.saveChanges()`.
   */
  public detectChanges(): void {
    for (const tracked of this._trackedEntities.values()) {
      if (tracked.state === EntityState.Unchanged && tracked.originalValues) {
        if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
          tracked.state = EntityState.Modified;
        }
      }
    }
  }

  // ─── Cloning & equality ───────────────────────────────────────────────────

  private cloneObject<T>(obj: T): T {
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
      const ka = Object.keys(a as object).sort();
      const kb = Object.keys(b as object).sort();
      if (ka.join('\x00') !== kb.join('\x00')) return false;
      return ka.every((k) =>
        this.areObjectsEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      );
    }
    return false;
  }
}
