import type { TrackedEntity } from '@ts-linq/types';

import type { LocalViewChangeType } from '../LocalView';

/**
 * Observer of tracked-entity mutations (refactor task-4).
 *
 * The state machine emits transitions to observers instead of hard-wiring calls
 * to `LocalView`, decoupling the unit-of-work core from the observable view layer.
 */
export interface ITrackedEntityObserver {
  /** A single entity was added, re-attached, state-changed, or removed. */
  onTracked(tracked: TrackedEntity, changeType: LocalViewChangeType): void;
  /** Bulk re-synchronisation point (e.g. after `acceptAllChanges` / `clear`). */
  onSync(allTracked: Map<object, TrackedEntity>): void;
}
