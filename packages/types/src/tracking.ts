// Change tracking primitives

import type { EntityState } from './enums';
import type { EntityCtorRef } from './metadata';

/** Tracked entity with state for change tracking */
export interface TrackedEntity {
  entity: object;
  entityClass: EntityCtorRef;
  state: EntityState;
  originalValues?: object;
}
