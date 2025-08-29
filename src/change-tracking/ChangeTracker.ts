import { EntityState, TrackedEntity } from '../types';

export class ChangeTracker {
    private _trackedEntities: Map<any, TrackedEntity> = new Map();

    /**
     * Add an entity to be tracked as Added
     */
    public add(entity: any, entityClass: Function): void {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: EntityState.Added
        });
    }

    /**
     * Track an entity as Modified
     */
    public update(entity: any, entityClass: Function): void {
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

    /**
     * Track an entity as Deleted
     */
    public remove(entity: any, entityClass: Function): void {
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

    /**
     * Track an entity as Unchanged (loaded from database)
     */
    public attach(entity: any, entityClass: Function): void {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: EntityState.Unchanged,
            originalValues: this.cloneObject(entity)
        });
    }

    /**
     * Get all tracked changes
     */
    public getChanges(): TrackedEntity[] {
        return Array.from(this._trackedEntities.values())
            .filter(tracked => tracked.state !== EntityState.Unchanged);
    }

    /**
     * Get the state of a specific entity
     */
    public getEntityState(entity: any): EntityState {
        const tracked = this._trackedEntities.get(entity);
        return tracked ? tracked.state : EntityState.Unchanged;
    }

    /**
     * Accept all changes and reset tracking
     */
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

    /**
     * Clear all tracked entities
     */
    public clear(): void {
        this._trackedEntities.clear();
    }

    /**
     * Detect changes in tracked entities
     */
    public detectChanges(): void {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === EntityState.Unchanged && tracked.originalValues) {
                if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
                    tracked.state = EntityState.Modified;
                }
            }
        }
    }

    /**
     * Clone an object for original values tracking
     */
    private cloneObject(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Compare two objects for equality
     */
    private areObjectsEqual(obj1: any, obj2: any): boolean {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }
}
