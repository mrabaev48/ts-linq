export type TrackedEntity = {
  entity: object;
  entityClass: Function;
  state: 'Added' | 'Modified' | 'Deleted' | 'Unchanged' | string;
  originalValues?: object;
};

export enum EntityState {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted',
  Unchanged = 'unchanged'
}

export class ChangeTracker {
  private _trackedEntities: Map<object, TrackedEntity> = new Map();

  public add<T extends object>(entity: T, entityClass: Function): void {
    this._trackedEntities.set(entity, {
      entity,
      entityClass,
      state: EntityState.Added
    });
  }

  public update<T extends object>(entity: T, entityClass: Function): void {
    const existing = this._trackedEntities.get(entity);
    if (existing) {
      existing.state = EntityState.Modified;
    } else {
      this._trackedEntities.set(entity, {
        entity,
        entityClass,
        state: EntityState.Modified,
        originalValues: this.cloneObject(entity)
      });
    }
  }

  public remove<T extends object>(entity: T, entityClass: Function): void {
    const existing = this._trackedEntities.get(entity);
    if (existing) {
      existing.state = EntityState.Deleted;
    } else {
      this._trackedEntities.set(entity, {
        entity,
        entityClass,
        state: EntityState.Deleted
      });
    }
  }

  public attach<T extends object>(entity: T, entityClass: Function): void {
    this._trackedEntities.set(entity, {
      entity,
      entityClass,
      state: EntityState.Unchanged,
      originalValues: this.cloneObject(entity)
    });
  }

  public getChanges(): TrackedEntity[] {
    return Array.from(this._trackedEntities.values()).filter(
      (tracked) => tracked.state !== EntityState.Unchanged
    );
  }

  public getEntityState(entity: object): EntityState {
    const tracked = this._trackedEntities.get(entity);
    return tracked ? tracked.state : EntityState.Unchanged;
  }

  public acceptAllChanges(): void {
    for (const tracked of this._trackedEntities.values()) {
      if (tracked.state === EntityState.Deleted) {
        this._trackedEntities.delete(tracked.entity);
      } else {
        tracked.state = EntityState.Unchanged;
        tracked.originalValues = this.cloneObject(tracked.entity);
      }
    }
  }

  public clear(): void {
    this._trackedEntities.clear();
  }

  public detectChanges(): void {
    for (const tracked of this._trackedEntities.values()) {
      if (tracked.state === EntityState.Unchanged && tracked.originalValues) {
        if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
          tracked.state = EntityState.Modified;
        }
      }
    }
  }

  private cloneObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private areObjectsEqual<T>(obj1: T, obj2: T): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }
}


