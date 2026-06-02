// Change tracking primitives

import type { EntityState } from './enums';

/** Tracked entity with state for change tracking */
export interface TrackedEntity {
  entity: object;
  entityClass: Function;
  state: EntityState;
  originalValues?: object;
}
