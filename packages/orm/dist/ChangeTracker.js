"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeTracker = void 0;
const core_1 = require("@ts-linq/core");
/**
 * Tracks entities and their states (Added, Modified, Deleted, Unchanged)
 * to enable unit-of-work style persistence via `saveChanges`.
 */
class ChangeTracker {
    constructor() {
        this._trackedEntities = new Map();
    }
    /**
     * Add an entity to be tracked as Added
     * @param entity The entity instance to track.
     * @param entityClass Constructor of the entity type.
     */
    add(entity, entityClass) {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: core_1.EntityState.Added
        });
    }
    /**
     * Track an entity as Modified
     * @param entity The entity instance to mark as modified.
     * @param entityClass Constructor of the entity type.
     */
    update(entity, entityClass) {
        const existing = this._trackedEntities.get(entity);
        if (existing) {
            existing.state = core_1.EntityState.Modified;
        }
        else {
            this._trackedEntities.set(entity, {
                entity,
                entityClass,
                state: core_1.EntityState.Modified,
                originalValues: this.cloneObject(entity)
            });
        }
    }
    /**
     * Track an entity as Deleted
     * @param entity The entity instance to mark as deleted.
     * @param entityClass Constructor of the entity type.
     */
    remove(entity, entityClass) {
        const existing = this._trackedEntities.get(entity);
        if (existing) {
            existing.state = core_1.EntityState.Deleted;
        }
        else {
            this._trackedEntities.set(entity, {
                entity,
                entityClass,
                state: core_1.EntityState.Deleted
            });
        }
    }
    /**
     * Track an entity as Unchanged (loaded from database)
     * @param entity The entity instance loaded from the database.
     * @param entityClass Constructor of the entity type.
     */
    attach(entity, entityClass) {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: core_1.EntityState.Unchanged,
            originalValues: this.cloneObject(entity)
        });
    }
    /**
     * Get all tracked changes
     * @returns Tracked entities excluding those in Unchanged state.
     */
    getChanges() {
        return Array.from(this._trackedEntities.values()).filter((tracked) => tracked.state !== core_1.EntityState.Unchanged);
    }
    /**
     * Get the state of a specific entity
     * @param entity The entity instance.
     * @returns The current state (defaults to Unchanged if not tracked).
     */
    getEntityState(entity) {
        const tracked = this._trackedEntities.get(entity);
        return tracked ? tracked.state : core_1.EntityState.Unchanged;
    }
    /**
     * Accept all changes and reset tracking
     */
    acceptAllChanges() {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === core_1.EntityState.Deleted) {
                this._trackedEntities.delete(tracked.entity);
            }
            else {
                tracked.state = core_1.EntityState.Unchanged;
                tracked.originalValues = this.cloneObject(tracked.entity);
            }
        }
    }
    /**
     * Clear all tracked entities
     */
    clear() {
        this._trackedEntities.clear();
    }
    /**
     * Detect changes in tracked entities
     */
    detectChanges() {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === core_1.EntityState.Unchanged && tracked.originalValues) {
                if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
                    tracked.state = core_1.EntityState.Modified;
                }
            }
        }
    }
    /**
     * Clone an object for original values tracking
     * @param obj Arbitrary serializable object.
     * @returns A deep clone via JSON serialization.
     */
    cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    /**
     * Compare two objects for equality
     * @param obj1 First object.
     * @param obj2 Second object.
     * @returns True if objects are deeply equal by JSON representation.
     */
    areObjectsEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }
}
exports.ChangeTracker = ChangeTracker;
//# sourceMappingURL=ChangeTracker.js.map