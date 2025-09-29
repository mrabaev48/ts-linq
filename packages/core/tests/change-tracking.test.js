"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChangeTracker_1 = require("../src/change-tracking/ChangeTracker");
const types_1 = require("../src/types");
describe('ChangeTracker', () => {
    let changeTracker;
    let testEntity;
    beforeEach(() => {
        changeTracker = new ChangeTracker_1.ChangeTracker();
        testEntity = { id: 1, name: 'Test' };
    });
    describe('add', () => {
        it('should track entity as added', () => {
            changeTracker.add(testEntity, Object);
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Added);
        });
        it('should include added entity in changes', () => {
            changeTracker.add(testEntity, Object);
            const changes = changeTracker.getChanges();
            expect(changes).toHaveLength(1);
            expect(changes[0].state).toBe(types_1.EntityState.Added);
            expect(changes[0].entity).toBe(testEntity);
        });
    });
    describe('update', () => {
        it('should track entity as modified', () => {
            changeTracker.update(testEntity, Object);
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Modified);
        });
        it('should store original values for new entities', () => {
            changeTracker.update(testEntity, Object);
            const changes = changeTracker.getChanges();
            expect(changes[0].originalValues).toEqual({ id: 1, name: 'Test' });
        });
        it('should update state of existing tracked entity', () => {
            changeTracker.add(testEntity, Object);
            changeTracker.update(testEntity, Object);
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Modified);
        });
    });
    describe('remove', () => {
        it('should track entity as deleted', () => {
            changeTracker.remove(testEntity, Object);
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Deleted);
        });
    });
    describe('attach', () => {
        it('should track entity as unchanged', () => {
            changeTracker.attach(testEntity, Object);
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Unchanged);
        });
        it('should not include unchanged entity in changes', () => {
            changeTracker.attach(testEntity, Object);
            const changes = changeTracker.getChanges();
            expect(changes).toHaveLength(0);
        });
    });
    describe('detectChanges', () => {
        it('should detect changes in unchanged entities', () => {
            changeTracker.attach(testEntity, Object);
            // Modify the entity
            testEntity.name = 'Modified';
            changeTracker.detectChanges();
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Modified);
        });
        it('should not modify state of already changed entities', () => {
            changeTracker.add(testEntity, Object);
            testEntity.name = 'Modified';
            changeTracker.detectChanges();
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Added);
        });
    });
    describe('acceptAllChanges', () => {
        it('should reset all entities to unchanged state', () => {
            changeTracker.add(testEntity, Object);
            changeTracker.acceptAllChanges();
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Unchanged);
        });
        it('should remove deleted entities from tracking', () => {
            changeTracker.remove(testEntity, Object);
            changeTracker.acceptAllChanges();
            const state = changeTracker.getEntityState(testEntity);
            expect(state).toBe(types_1.EntityState.Unchanged); // Default for untracked entities
        });
    });
    describe('clear', () => {
        it('should remove all tracked entities', () => {
            changeTracker.add(testEntity, Object);
            changeTracker.clear();
            const changes = changeTracker.getChanges();
            expect(changes).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=change-tracking.test.js.map