import type { TrackedEntity } from '../types';
import { EntityState } from '../types';
/**
 * Tracks entities and their states (Added, Modified, Deleted, Unchanged)
 * to enable unit-of-work style persistence via `saveChanges`.
 */
export declare class ChangeTracker {
    private _trackedEntities;
    /**
     * Add an entity to be tracked as Added
     * @param entity The entity instance to track.
     * @param entityClass Constructor of the entity type.
     */
    add<T extends object>(entity: T, entityClass: Function): void;
    /**
     * Track an entity as Modified
     * @param entity The entity instance to mark as modified.
     * @param entityClass Constructor of the entity type.
     */
    update<T extends object>(entity: T, entityClass: Function): void;
    /**
     * Track an entity as Deleted
     * @param entity The entity instance to mark as deleted.
     * @param entityClass Constructor of the entity type.
     */
    remove<T extends object>(entity: T, entityClass: Function): void;
    /**
     * Track an entity as Unchanged (loaded from database)
     * @param entity The entity instance loaded from the database.
     * @param entityClass Constructor of the entity type.
     */
    attach<T extends object>(entity: T, entityClass: Function): void;
    /**
     * Get all tracked changes
     * @returns Tracked entities excluding those in Unchanged state.
     */
    getChanges(): TrackedEntity[];
    /**
     * Get the state of a specific entity
     * @param entity The entity instance.
     * @returns The current state (defaults to Unchanged if not tracked).
     */
    getEntityState(entity: object): EntityState;
    /**
     * Accept all changes and reset tracking
     */
    acceptAllChanges(): void;
    /**
     * Clear all tracked entities
     */
    clear(): void;
    /**
     * Detect changes in tracked entities
     */
    detectChanges(): void;
    /**
     * Clone an object for original values tracking
     * @param obj Arbitrary serializable object.
     * @returns A deep clone via JSON serialization.
     */
    private cloneObject;
    /**
     * Compare two objects for equality
     * @param obj1 First object.
     * @param obj2 Second object.
     * @returns True if objects are deeply equal by JSON representation.
     */
    private areObjectsEqual;
}
//# sourceMappingURL=ChangeTracker.d.ts.map