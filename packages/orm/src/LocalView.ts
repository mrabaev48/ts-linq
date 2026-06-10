import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

/** The type of mutation that triggered a LocalView change notification. */
export type LocalViewChangeType = 'added' | 'removed' | 'modified';

/** Payload delivered to every LocalView subscriber on each tracked-entity mutation. */
export interface LocalViewChange<T> {
  readonly type: LocalViewChangeType;
  readonly entity: T;
}

/** Listener function registered via {@link LocalView.subscribe}. */
export type LocalViewListener<T> = (change: LocalViewChange<T>) => void;

/**
 * An in-memory observable view of all entities of a given type that are
 * currently tracked by the `ChangeTracker` with state `Added`, `Unchanged`,
 * or `Modified` (i.e. everything that is *not* `Deleted`).
 *
 * Mirrors EF Core's `LocalView<T>` / `ObservableCollection<T>`.
 *
 * @example
 * const local = context.posts.local;
 * const unsubscribe = local.subscribe(change => console.log(change.type, change.entity));
 *
 * // Enumerate current in-memory entities:
 * for (const post of local) { ... }
 * // or:
 * const arr = local.toArray();
 */
export class LocalView<T extends object> {
  /** All tracked entries for this entity type, keyed by entity reference. */
  private readonly _entries: Map<object, TrackedEntity> = new Map();
  private readonly _listeners: Set<LocalViewListener<T>> = new Set();

  // ─── Internal API (called by ChangeTracker) ───────────────────────────────

  /**
   * Called by ChangeTracker whenever an entity of this type is added,
   * re-attached, state-changed, or removed from tracking.
   * @internal
   */
  _onTracked(tracked: TrackedEntity, changeType: LocalViewChangeType): void {
    const entity = tracked.entity as T;

    if (changeType === 'removed' || tracked.state === EntityState.Deleted) {
      this._entries.delete(tracked.entity);
      this._emit({ type: 'removed', entity });
    } else {
      const isNew = !this._entries.has(tracked.entity);
      this._entries.set(tracked.entity, tracked);
      this._emit({ type: isNew ? 'added' : changeType, entity });
    }
  }

  /**
   * Called by ChangeTracker.acceptAllChanges / clear to synchronise the view.
   * @internal
   */
  _sync(allTracked: Map<object, TrackedEntity>): void {
    // Remove entries no longer in tracker or now Deleted
    for (const [ref, tracked] of this._entries) {
      const current = allTracked.get(ref);
      if (!current || current.state === EntityState.Deleted) {
        this._entries.delete(ref);
        this._emit({ type: 'removed', entity: ref as T });
      }
    }
    // Add any newly visible entries
    for (const [ref, trackedEntry] of allTracked) {
      if (
        trackedEntry.entityClass === this._entityClass &&
        trackedEntry.state !== EntityState.Deleted &&
        !this._entries.has(ref)
      ) {
        this._entries.set(ref, trackedEntry);
        this._emit({ type: 'added', entity: ref as T });
      }
    }
  }

  /** @internal Entity class this view is scoped to — set once by ChangeTracker. */

  _entityClass!: EntityCtorRef;

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Subscribe to change notifications.
   * Returns an unsubscribe function — call it to stop receiving events.
   *
   * @example
   * const off = local.subscribe(ch => console.log(ch.type, ch.entity));
   * // later:
   * off();
   */
  subscribe(listener: LocalViewListener<T>): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Returns a snapshot array of all currently tracked entities of this type
   * that are NOT in the `Deleted` state.
   */
  toArray(): T[] {
    return Array.from(this._entries.values())
      .filter((t) => t.state !== EntityState.Deleted)
      .map((t) => t.entity as T);
  }

  /** Iterate over all non-deleted tracked entities of this type. */
  [Symbol.iterator](): Iterator<T> {
    return this.toArray()[Symbol.iterator]();
  }

  /** Number of non-deleted tracked entities currently in view. */
  get count(): number {
    let n = 0;
    for (const t of this._entries.values()) {
      if (t.state !== EntityState.Deleted) n++;
    }
    return n;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _emit(change: LocalViewChange<T>): void {
    for (const listener of this._listeners) {
      listener(change);
    }
  }
}
