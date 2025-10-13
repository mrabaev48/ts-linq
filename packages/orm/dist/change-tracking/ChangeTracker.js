"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeTracker = void 0;
const types_1 = require("@ts-linq/core/dist/types");
class ChangeTracker {
    constructor() {
        this._trackedEntities = new Map();
    }
    add(entity, entityClass) {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: types_1.EntityState.Added
        });
    }
    update(entity, entityClass) {
        const existing = this._trackedEntities.get(entity);
        if (existing) {
            existing.state = types_1.EntityState.Modified;
        }
        else {
            this._trackedEntities.set(entity, {
                entity,
                entityClass,
                state: types_1.EntityState.Modified,
                originalValues: this.cloneObject(entity)
            });
        }
    }
    remove(entity, entityClass) {
        const existing = this._trackedEntities.get(entity);
        if (existing) {
            existing.state = types_1.EntityState.Deleted;
        }
        else {
            this._trackedEntities.set(entity, {
                entity,
                entityClass,
                state: types_1.EntityState.Deleted
            });
        }
    }
    attach(entity, entityClass) {
        this._trackedEntities.set(entity, {
            entity,
            entityClass,
            state: types_1.EntityState.Unchanged,
            originalValues: this.cloneObject(entity)
        });
    }
    getChanges() {
        return Array.from(this._trackedEntities.values()).filter((tracked) => tracked.state !== types_1.EntityState.Unchanged);
    }
    getEntityState(entity) {
        const tracked = this._trackedEntities.get(entity);
        return tracked ? tracked.state : types_1.EntityState.Unchanged;
    }
    acceptAllChanges() {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === types_1.EntityState.Deleted) {
                this._trackedEntities.delete(tracked.entity);
            }
            else {
                tracked.state = types_1.EntityState.Unchanged;
                tracked.originalValues = this.cloneObject(tracked.entity);
            }
        }
    }
    clear() {
        this._trackedEntities.clear();
    }
    detectChanges() {
        for (const tracked of this._trackedEntities.values()) {
            if (tracked.state === types_1.EntityState.Unchanged && tracked.originalValues) {
                if (!this.areObjectsEqual(tracked.entity, tracked.originalValues)) {
                    tracked.state = types_1.EntityState.Modified;
                }
            }
        }
    }
    cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    areObjectsEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }
}
exports.ChangeTracker = ChangeTracker;
//# sourceMappingURL=ChangeTracker.js.map