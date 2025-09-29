"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const DbSet_1 = require("../src/context/DbSet");
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const ChangeTracker_1 = require("../src/change-tracking/ChangeTracker");
const src_1 = require("../src");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
    constructor() {
        super(...arguments);
        this.tables = new Map();
    }
    async connect() {
        /* no-op */
    }
    async disconnect() {
        /* no-op */
    }
    async createTable(entityMetadata) {
        if (!entityMetadata)
            return;
        const table = entityMetadata.tableName;
        const pk = entityMetadata.primaryKeys[0];
        if (!this.tables.has(table))
            this.tables.set(table, { rows: [], pk });
    }
    getDialect() {
        return {
            buildSelect: (ctor) => {
                const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
                return { query: `SELECT * FROM ${meta.tableName}`, parameters: [] };
            }
        };
    }
    async insert(entity, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        const table = meta.tableName;
        const slot = this.tables.get(table);
        const pk = meta.primaryKeys[0];
        const copy = { ...entity };
        if (pk && (copy[pk] === undefined || copy[pk] === null)) {
            copy[pk] = (slot.rows.length ? slot.rows[slot.rows.length - 1][pk] || 0 : 0) + 1;
            entity[pk] = copy[pk];
        }
        slot.rows.push(copy);
        return entity;
    }
    async update(entity, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        const table = meta.tableName;
        const pk = meta.primaryKeys[0];
        const slot = this.tables.get(table);
        const idx = slot.rows.findIndex((r) => r[pk] === entity[pk]);
        if (idx >= 0)
            slot.rows[idx] = { ...entity };
        return entity;
    }
    async delete(entity, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        const table = meta.tableName;
        const pk = meta.primaryKeys[0];
        const slot = this.tables.get(table);
        const idx = slot.rows.findIndex((r) => r[pk] === entity[pk]);
        if (idx >= 0)
            slot.rows.splice(idx, 1);
    }
    async findById(id, entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        const table = meta.tableName;
        const pk = meta.primaryKeys[0];
        const slot = this.tables.get(table);
        const row = slot.rows.find((r) => r[pk] === id);
        return (row ?? null);
    }
    async findAll(entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        const table = meta.tableName;
        const slot = this.tables.get(table);
        return slot.rows.slice();
    }
    async findWhere() {
        return [];
    }
    async findWhereIn() {
        return [];
    }
    async doExecuteQuery(sql, _params) {
        const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
        if (countMatch) {
            const table = countMatch[1];
            const slot = this.tables.get(table);
            const n = slot ? slot.rows.length : 0;
            return [{ count: n }];
        }
        const m = /FROM\s+(\w+)/i.exec(sql);
        if (m) {
            const table = m[1];
            const slot = this.tables.get(table);
            if (slot)
                return slot.rows.slice();
        }
        return [];
    }
    async doExecuteNonQuery(sql) {
        const m = /DELETE\s+FROM\s+(\w+)/i.exec(sql);
        if (m) {
            const table = m[1];
            const slot = this.tables.get(table);
            if (slot) {
                const n = slot.rows.length;
                slot.rows = [];
                return n;
            }
        }
        return 0;
    }
    async beginTransaction() {
        this.inTransaction = true;
    }
    async commitTransaction() {
        this.inTransaction = false;
    }
    async rollbackTransaction() {
        this.inTransaction = false;
    }
}
const types_1 = require("../src/types");
// Define test entity inside function to ensure decorators execute properly
function createTestEntity() {
    let TestEntity = class TestEntity {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], TestEntity.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)(),
        __metadata("design:type", String)
    ], TestEntity.prototype, "name", void 0);
    TestEntity = __decorate([
        (0, src_1.Entity)()
    ], TestEntity);
    return TestEntity;
}
describe('DbSet', () => {
    let dbSet;
    let provider;
    let changeTracker;
    let TestEntity;
    beforeEach(async () => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        // Create test entity
        TestEntity = createTestEntity();
        provider = new ProviderStub('');
        changeTracker = new ChangeTracker_1.ChangeTracker();
        dbSet = new DbSet_1.DbSet(TestEntity, provider, changeTracker);
        await provider.connect();
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
        await provider.createTable(metadata);
    });
    afterEach(async () => {
        await provider.disconnect();
    });
    describe('add', () => {
        it('should track entity as added', () => {
            const entity = new TestEntity();
            entity.name = 'Test';
            const result = dbSet.add(entity);
            expect(result).toBe(entity);
            expect(changeTracker.getEntityState(entity)).toBe(types_1.EntityState.Added);
        });
    });
    describe('update', () => {
        it('should track entity as modified', () => {
            const entity = new TestEntity();
            entity.name = 'Test';
            const result = dbSet.update(entity);
            expect(result).toBe(entity);
            expect(changeTracker.getEntityState(entity)).toBe(types_1.EntityState.Modified);
        });
    });
    describe('remove', () => {
        it('should track entity as deleted', () => {
            const entity = new TestEntity();
            entity.name = 'Test';
            const result = dbSet.remove(entity);
            expect(result).toBe(entity);
            expect(changeTracker.getEntityState(entity)).toBe(types_1.EntityState.Deleted);
        });
    });
    describe('find', () => {
        it('should find entity by id', async () => {
            const entity = new TestEntity();
            entity.name = 'Test Entity';
            const inserted = await provider.insert(entity, TestEntity);
            const found = await dbSet.find(inserted.id);
            expect(found).toBeDefined();
            expect(found.name).toBe('Test Entity');
        });
        it('should return null for non-existent id', async () => {
            const found = await dbSet.find(999);
            expect(found).toBeNull();
        });
    });
    describe('toArray', () => {
        it('should return all entities', async () => {
            const entity1 = new TestEntity();
            entity1.name = 'Entity 1';
            const entity2 = new TestEntity();
            entity2.name = 'Entity 2';
            await provider.insert(entity1, TestEntity);
            await provider.insert(entity2, TestEntity);
            const entities = await dbSet.toArray();
            expect(entities).toHaveLength(2);
        });
    });
    describe('query methods', () => {
        beforeEach(async () => {
            for (let i = 1; i <= 5; i++) {
                const entity = new TestEntity();
                entity.name = `Entity ${i}`;
                await provider.insert(entity, TestEntity);
            }
        });
        it('should count entities', async () => {
            const count = await dbSet.count();
            expect(count).toBe(5);
        });
        it('should check if any entities exist', async () => {
            const any = await dbSet.any();
            expect(any).toBe(true);
        });
        it('should get first entity', async () => {
            const first = await dbSet.first();
            expect(first).toBeDefined();
            expect(first.name).toBe('Entity 1');
        });
        it('should get first or default', async () => {
            const firstOrDefault = await dbSet.firstOrDefault();
            expect(firstOrDefault).toBeDefined();
        });
        it('should throw on first when no entities exist', async () => {
            // Clear all entities
            await provider.executeNonQuery('DELETE FROM TestEntity');
            await expect(dbSet.first()).rejects.toThrow('Sequence contains no elements');
        });
        it('should return null on firstOrDefault when no entities exist', async () => {
            // Clear all entities
            await provider.executeNonQuery('DELETE FROM TestEntity');
            const result = await dbSet.firstOrDefault();
            expect(result).toBeNull();
        });
        it('should support include(selector) chained before where', async () => {
            // include now validates against metadata; using non-existing relation should throw
            await expect(async () => {
                await dbSet
                    .include((e) => e.nonExistingRelation)
                    .where((e) => e.name === 'Entity 1')
                    .toArray();
            }).rejects.toThrow(/Invalid include/);
        });
    });
});
//# sourceMappingURL=dbset.test.js.map