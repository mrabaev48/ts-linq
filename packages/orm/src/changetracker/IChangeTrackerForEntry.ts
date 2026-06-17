import type { EntityCtorRef, EntityState } from '@ts-linq/types';

/**
 * Narrow change-tracker capabilities an {@link EntityEntry} / {@link PropertyEntry}
 * needs. Depending on this leaf interface (rather than the concrete `ChangeTracker`)
 * breaks the `ChangeTracker ↔ EntityEntry` import cycle (refactor task-4): the
 * entry types no longer point back at the tracker, so the tracker may freely
 * produce entries through the {@link EntryFactory} seam.
 */
export interface IChangeTrackerForEntry {
  getEntityState(entity: object): EntityState;
  setState(entity: object, entityClass: EntityCtorRef, state: EntityState): void;
  getShadowValue(entity: object, name: string): unknown;
  setShadowValue(entity: object, name: string, value: unknown): void;
}
