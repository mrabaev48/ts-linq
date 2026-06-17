import type { EntityCtorRef } from '@ts-linq/types';

import type { EntityEntry } from './EntityEntry';
import type { IChangeTrackerForEntry } from './IChangeTrackerForEntry';

/**
 * Abstract Factory that produces {@link EntityEntry} instances for the change
 * tracker (refactor task-4). Injected into `ChangeTracker.findEntry`/`entries`
 * so the tracker depends on this seam rather than constructing `EntityEntry`
 * directly — the mechanism that lets `ChangeTrackerFacade` be removed.
 */
export type EntryFactory = <T extends object>(
  entity: T,
  entityClass: EntityCtorRef,
  provider: unknown,
  tracker: IChangeTrackerForEntry
) => EntityEntry<T>;
