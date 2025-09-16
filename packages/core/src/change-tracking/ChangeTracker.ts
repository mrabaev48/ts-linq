import type { TrackedEntity } from '../types';
import { EntityState } from '../types';

/**
 * Tracks entities and their states (Added, Modified, Deleted, Unchanged)
 * to enable unit-of-work style persistence via `saveChanges`.
 */
export class ChangeTracker {
  private _trackedEntities: Map<object, TrackedEntity> = new Map();

  /**
   * Add an entity to be tracked as Added
   * @param entity The entity instance to track.
   * @param entityClass Constructor of the entity type.
   */
  public add<T extends object>(entity: T, entityClass: Function): void {
    this._trackedEntities.set(entity, {
      entity,
      entityClass,
      state: EntityState.Added
    });
  }

  /**
   * Track an entity as Modified
   * @param entity The entity instance to mark as modified.
   * @param entityClass Constructor of the entity type.
   */
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

  /**
   * Track an entity as Deleted
   * @param entity The entity instance to mark as deleted.
   * @param entityClass Constructor of the entity type.
   */
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

  /**
   * Track an entity as Unchanged (loaded from database)
   * @param entity The entity instance loaded from the database.
   * @param entityClass Constructor of the entity type.
   */
  public attach<T extends object>(entity: T, entityClass: Function): void {
    this._trackedEntities.set(entity, {
      entity,
      entityClass,
      state: EntityState.Unchanged,
      originalValues: this.cloneObject(entity)
    });
  }

  /**
   * Get all tracked changes
   * @returns Tracked entities excluding those in Unchanged state.
   */
  public getChanges(): TrackedEntity[] {
    return Array.from(this._trackedEntities.values()).filter(
      (tracked) => tracked.state !== EntityState.Unchanged
    );
  }

  /**
   * Get the state of a specific entity
   * @param entity The entity instance.
   * @returns The current state (defaults to Unchanged if not tracked).
   */
  public getEntityState(entity: object): EntityState {
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
   * @param obj Arbitrary serializable object.
   * @returns A deep clone via JSON serialization.
   */
  private cloneObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Compare two objects for equality
   * @param obj1 First object.
   * @param obj2 Second object.
   * @returns True if objects are deeply equal by JSON representation.
   */
  private areObjectsEqual<T>(obj1: T, obj2: T): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }
}
