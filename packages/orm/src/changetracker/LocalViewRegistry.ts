import type { EntityCtorRef, TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import { LocalView, type LocalViewChangeType } from '../LocalView';
import type { ITrackedEntityObserver } from './ITrackedEntityObserver';

/**
 * Owns the per-entity-class `LocalView` instances and routes tracked-entity
 * events to the right view. Implements {@link ITrackedEntityObserver} so the
 * state machine can emit transitions without knowing about `LocalView`
 * (refactor task-4 — replaces the inline `notifyLocalView` fan-out).
 */
export class LocalViewRegistry implements ITrackedEntityObserver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly views: Map<EntityCtorRef, LocalView<any>> = new Map();

  /**
   * Returns (or lazily creates) the view for `entityClass`, seeding a freshly
   * created view from the currently-tracked, non-Deleted entities so it is never stale.
   */
  getOrCreate<T extends object>(
    entityClass: EntityCtorRef,
    tracked: Iterable<TrackedEntity>
  ): LocalView<T> {
    let view = this.views.get(entityClass) as LocalView<T> | undefined;
    if (!view) {
      view = new LocalView<T>();
      view._entityClass = entityClass;
      for (const t of tracked) {
        if (t.entityClass === entityClass && t.state !== EntityState.Deleted) {
          view._onTracked(t, 'added');
        }
      }
      this.views.set(entityClass, view);
    }
    return view;
  }

  onTracked(tracked: TrackedEntity, changeType: LocalViewChangeType): void {
    const view = this.views.get(tracked.entityClass);
    if (view) {
      view._onTracked(tracked, changeType);
    }
  }

  onSync(allTracked: Map<object, TrackedEntity>): void {
    for (const view of this.views.values()) {
      view._sync(allTracked);
    }
  }
}
