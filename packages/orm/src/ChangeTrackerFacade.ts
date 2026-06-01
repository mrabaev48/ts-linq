import type { MetadataRegistry } from '@ts-linq/metadata';

import { ChangeTracker } from './ChangeTracker';
import { EntityEntry } from './changetracker/EntityEntry';

/**
 * Extends {@link ChangeTracker} with the EF Core-style high-level API
 * (`findEntry`, `entries`) that wraps raw tracked data in {@link EntityEntry}.
 *
 * `ChangeTracker` itself cannot import `EntityEntry` (circular dependency), so
 * this thin facade lives in a separate file that can safely depend on both.
 *
 * `DbContext` always creates and exposes a `ChangeTrackerFacade` — callers
 * interact with the full API without knowing the internal split.
 */
export class ChangeTrackerFacade extends ChangeTracker {
  constructor(registry?: MetadataRegistry) {
    super(registry);
  }

  /**
   * Find a tracked `EntityEntry<T>` by primary key value(s).
   * Returns `undefined` when the entity is not currently tracked.
   *
   * Mirrors EF Core's `ChangeTracker.FindEntry<T>(keyValues)`.
   *
   * For composite PKs, pass the key values in the **alphabetical order** of
   * the PK column names (the same order used by {@link ChangeTracker.findTrackedByPk}).
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
    return new EntityEntry<T>(tracked.entity as T, entityClass, this._provider, this);
  }

  /**
   * Returns all `EntityEntry<T>` instances for a given entity class,
   * regardless of their current state (Added / Unchanged / Modified / Deleted).
   *
   * Mirrors EF Core's `ChangeTracker.Entries<T>()`.
   *
   * @example
   * const entries = context.changeTracker.entries(Post);
   */
  public entries<T extends object>(entityClass: new (...args: unknown[]) => T): EntityEntry<T>[] {
    return this.getTrackedForType(entityClass).map(
      (tracked) => new EntityEntry<T>(tracked.entity as T, entityClass, this._provider, this)
    );
  }
}
