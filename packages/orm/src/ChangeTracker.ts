import { QueryTrackingBehavior } from '@ts-linq/core';
import { type MetadataRegistry, MetadataStorage } from '@ts-linq/metadata';
import type { EntityAttacher, EntityCtorRef, EntityState, TrackedEntity } from '@ts-linq/types';

import { CascadeWalker } from './changetracker/CascadeWalker';
import { ChangeDetector } from './changetracker/ChangeDetector';
import { defaultEntryFactory } from './changetracker/defaultEntryFactory';
import type { EntityEntry } from './changetracker/EntityEntry';
import type { EntityEntryGraphNode } from './changetracker/EntityEntryGraphNode';
import { EntityStateMachine } from './changetracker/EntityStateMachine';
import type { EntryFactory } from './changetracker/EntryFactory';
import { defaultEqualityComparer, type EqualityComparer } from './changetracker/EqualityComparer';
import { GraphTracker } from './changetracker/GraphTracker';
import type { IChangeTrackerForEntry } from './changetracker/IChangeTrackerForEntry';
import { LocalViewRegistry } from './changetracker/LocalViewRegistry';
import { ShadowValueStore } from './changetracker/ShadowValueStore';
import { type JoinRowChange, SkipNavigationTracker } from './changetracker/SkipNavigationTracker';
import { SnapshotStore } from './changetracker/SnapshotStore';
import { TrackedIdentityMap } from './changetracker/TrackedIdentityMap';
import type { LocalView } from './LocalView';

export type { JoinRowChange };

/**
 * Tracks entities and their states (Added, Modified, Deleted, Unchanged) to
 * enable unit-of-work style persistence via `saveChanges`.
 *
 * Composing facade over focused collaborators (refactor task-4): the
 * {@link EntityStateMachine} owns transitions, {@link TrackedIdentityMap} the
 * PK index, {@link SnapshotStore}/{@link ShadowValueStore} the originals/shadow
 * values, {@link ChangeDetector} dirty detection (single {@link EqualityComparer}),
 * {@link SkipNavigationTracker} m2m diffing, {@link GraphTracker} graph traversal,
 * and {@link LocalViewRegistry} the observable-view fan-out (observer). Entry
 * objects are produced through an injected {@link EntryFactory}, which lets this
 * class expose `findEntry`/`entries` without depending on the concrete
 * `EntityEntry` (the former `ChangeTrackerFacade` subclass is gone).
 *
 * Key guarantees:
 *  - Identity Map: deduplicates entities with the same primary key.
 *  - structuredClone snapshots: handle Date/BigInt/Map/Set (JSON fallback).
 *  - Deterministic, key-order-insensitive equality.
 *  - Auto-detectChanges inside `DbContext.saveChanges()`.
 */
export class ChangeTracker implements EntityAttacher, IChangeTrackerForEntry {
  private readonly _registry: MetadataRegistry;

  /** Single equality strategy used by all change detection (refactor task-4). */
  private readonly _comparer: EqualityComparer = defaultEqualityComparer;

  private readonly _shadowStore: ShadowValueStore = new ShadowValueStore();
  private readonly _views: LocalViewRegistry = new LocalViewRegistry();
  private readonly _snapshots: SnapshotStore;
  private readonly _detector: ChangeDetector;
  private readonly _skipNav: SkipNavigationTracker;
  private readonly _identityMap: TrackedIdentityMap;
  private readonly _stateMachine: EntityStateMachine;
  private readonly _graphTracker: GraphTracker;

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

  /** Provider reference passed to EntityEntry nodes created by findEntry / entries. */
  protected _provider: unknown = undefined;

  /** Produces EntityEntry instances; injectable to break the EntityEntry cycle. */
  private _entryFactory: EntryFactory = defaultEntryFactory;

  constructor(registry?: MetadataRegistry) {
    this._registry = registry ?? MetadataStorage.getInstance();
    this._snapshots = new SnapshotStore(this._registry);
    this._detector = new ChangeDetector(this._registry, this._comparer, this._shadowStore);
    this._skipNav = new SkipNavigationTracker(this._registry);
    this._identityMap = new TrackedIdentityMap(this._registry);
    this._stateMachine = new EntityStateMachine(
      this._identityMap,
      this._snapshots,
      this._skipNav,
      this._views
    );
    this._graphTracker = new GraphTracker(this._registry, this);
  }

  /** Called by DbContext to wire the provider into EntityEntry nodes. */
  public setProvider(provider: unknown): void {
    this._provider = provider;
  }

  /** Override the factory used to build EntityEntry instances (DI / testing). */
  public setEntryFactory(factory: EntryFactory): void {
    this._entryFactory = factory;
  }

  // ─── Public tracking API ─────────────────────────────────────────────────

  /** Track an entity as Added (dedup by object reference only). */
  public add<T extends object>(entity: T, entityClass: EntityCtorRef): void {
    this._stateMachine.add(entity, entityClass);
  }

  /** Track an entity as Modified (reuses an existing reference/PK match in place). */
  public update<T extends object>(entity: T, entityClass: EntityCtorRef): void {
    this._stateMachine.update(entity, entityClass);
  }

  /** Track an entity as Deleted (reuses an existing reference/PK match in place). */
  public remove<T extends object>(entity: T, entityClass: EntityCtorRef): void {
    this._stateMachine.remove(entity, entityClass);
  }

  /** Track an entity as Unchanged (Identity Map: one reference per PK per context). */
  public attach<T extends object>(entity: T, entityClass: EntityCtorRef): void {
    this._stateMachine.attach(entity, entityClass);
  }

  /**
   * Apply client-side cascade delete behaviors for all currently-deleted tracked entities.
   * Must be called after detectChanges() and before getChanges() in the saveChanges pipeline.
   */
  public applyCascades(): void {
    new CascadeWalker(this._registry).walk(this._stateMachine.all());
  }

  /** Return all tracked entities that have pending changes. */
  public getChanges(): TrackedEntity[] {
    return this._stateMachine.getChanges();
  }

  /** Return the current tracking state for a specific entity reference. */
  public getEntityState(entity: object): EntityState {
    return this._stateMachine.getEntityState(entity);
  }

  /** Accept all changes: deleted entries are removed, others reset to Unchanged. */
  public acceptAllChanges(): void {
    this._stateMachine.acceptAllChanges();
  }

  /** Clear all tracked entities from both maps. */
  public clear(): void {
    this._stateMachine.clear();
  }

  // ─── LocalView / FindEntry / Entries (P1-29) ──────────────────────────────

  /**
   * Returns (or lazily creates) the `LocalView<T>` for the given entity class.
   * The view is an observable snapshot of all non-Deleted tracked entities of
   * that type.  Mirrors `DbSet<T>.Local` in EF Core.
   */
  public getLocalView<T extends object>(entityClass: EntityCtorRef): LocalView<T> {
    return this._views.getOrCreate<T>(entityClass, this._stateMachine.all().values());
  }

  /**
   * Finds a raw `TrackedEntity` by primary key value(s).
   * Returns `undefined` when the entity is not currently tracked.
   *
   * @remarks
   * This is the low-level API. Consumers should call {@link findEntry} which wraps
   * the result in an {@link EntityEntry} with full state/property access.
   */
  public findTrackedByPk(
    entityClass: EntityCtorRef,
    ...pkValues: unknown[]
  ): TrackedEntity | undefined {
    return this._stateMachine.findByValues(entityClass, pkValues);
  }

  /**
   * Returns all `TrackedEntity` records for a given entity class.
   *
   * @remarks
   * This is the low-level API. Consumers should call {@link entries} which wraps
   * results in {@link EntityEntry}.
   */
  public getTrackedForType(entityClass: EntityCtorRef): TrackedEntity[] {
    return this._stateMachine.getTrackedForType(entityClass);
  }

  /**
   * Find a tracked `EntityEntry<T>` by primary key value(s).
   * Returns `undefined` when the entity is not currently tracked.
   *
   * Mirrors EF Core's `ChangeTracker.FindEntry<T>(keyValues)`. For composite PKs,
   * pass the key values in the **alphabetical order** of the PK column names.
   *
   * @example
   * const entry = context.changeTracker.findEntry(Post, 42);
   * const entry = context.changeTracker.findEntry(Order, customerId, orderId);
   */
  public findEntry<T extends object>(
    entityClass: new (...args: unknown[]) => T,
    ...pkValues: unknown[]
  ): EntityEntry<T> | undefined {
    const tracked = this.findTrackedByPk(entityClass, ...pkValues);
    if (!tracked) return undefined;
    return this._entryFactory(tracked.entity as T, entityClass, this._provider, this);
  }

  /**
   * Returns all `EntityEntry<T>` instances for a given entity class, regardless of
   * their current state (Added / Unchanged / Modified / Deleted).
   *
   * Mirrors EF Core's `ChangeTracker.Entries<T>()`.
   */
  public entries<T extends object>(entityClass: new (...args: unknown[]) => T): EntityEntry<T>[] {
    return this.getTrackedForType(entityClass).map((tracked) =>
      this._entryFactory(tracked.entity as T, entityClass, this._provider, this)
    );
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
    entityClass: EntityCtorRef,
    callback: (node: EntityEntryGraphNode) => void
  ): void {
    this._graphTracker.trackGraph(root, entityClass, callback);
  }

  /**
   * Directly set the tracking state of an already-tracked entity.
   * Used by `EntityEntry.state` setter and by `trackGraph` callbacks.
   */
  public setState(entity: object, entityClass: EntityCtorRef, state: EntityState): void {
    this._stateMachine.setState(entity, entityClass, state);
  }

  // ─── Shadow property API (P1-16) ─────────────────────────────────────────

  /** Read a shadow property value for a tracked entity. */
  public getShadowValue(entity: object, name: string): unknown {
    return this._shadowStore.get(entity, name);
  }

  /** Write a shadow property value for a tracked entity. */
  public setShadowValue(entity: object, name: string, value: unknown): void {
    this._shadowStore.set(entity, name, value);
  }

  /** Collect all shadow values for a tracked entity (used during persistence). */
  public getShadowValues(entity: object): Map<string, unknown> | undefined {
    return this._shadowStore.getAll(entity);
  }

  /**
   * Scan all Unchanged tracked entities and mark them Modified when their current
   * state differs from the stored `originalValues`. Called automatically by
   * `DbContext.saveChanges()`. Uses ValueComparer.equals for properties that have
   * a comparer configured.
   */
  public detectChanges(): void {
    this._detector.detectChanges(this._stateMachine.all().values());
  }

  // ─── Skip navigation (many-to-many) collection tracking ─────────────────

  /**
   * Compares current many-to-many collections against their snapshots and returns
   * the join-row inserts/deletes needed by `DbContext.saveChanges()`.
   */
  public collectSkipNavigationChanges(): JoinRowChange[] {
    return this._skipNav.collectChanges(this._stateMachine.all().values());
  }
}
