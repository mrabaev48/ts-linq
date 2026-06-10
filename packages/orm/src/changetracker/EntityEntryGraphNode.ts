import type { EntityCtorRef, EntityState } from '@ts-linq/types';

/**
 * Minimal entry interface exposed within a `trackGraph` callback.
 * Intentionally separate from the full `EntityEntry` class to avoid
 * circular imports between `ChangeTracker` and `EntityEntry`.
 */
export interface ITrackGraphEntry {
  readonly entity: unknown;
  readonly entityClass: EntityCtorRef;
  /** Current tracking state — read or set per-node inside the callback. */
  get state(): EntityState;
  set state(value: EntityState);
  /** True when the entity's primary-key field holds a non-empty value. */
  get isKeySet(): boolean;
}

/**
 * Represents a single node in a `trackGraph` traversal.
 * Exposed to the user callback for each reachable entity in the graph.
 */
export interface EntityEntryGraphNode {
  /** Entry for the entity at this node — provides state read/write and isKeySet. */
  readonly entry: ITrackGraphEntry;
  /** Name of the navigation property through which this node was reached, or undefined for the root. */
  readonly inboundNavigation: string | undefined;
}
