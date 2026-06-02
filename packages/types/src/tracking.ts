// Change tracking примитивы

/** Entity state for change tracking */
export enum EntityState {
  Unchanged = 'unchanged',
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted'
}

/** Tracked entity with state for change tracking */
export interface TrackedEntity {
  entity: object;
  entityClass: Function;
  state: EntityState;
  originalValues?: object;
}
