"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const Queryable_1 = require("../src/query/Queryable");
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
    async connect() { }
    async disconnect() { }
    async createTable() { }
    async insert(entity) {
        return entity;
    }
    async update(entity) {
        return entity;
    }
    async delete() { }
    async findById() {
        return null;
    }
    async findAll() {
        return [];
    }
    async findWhere() {
        return [];
    }
    async findWhereIn() {
        return [];
    }
    async doExecuteQuery(_sql, _params) {
        return [{ id: 1 }];
    }
    async doExecuteNonQuery(_sql, _params) {
        return 0;
    }
    async beginTransaction() { }
    async commitTransaction() { }
    async rollbackTransaction() { }
}
class DummyDialect {
    buildSelect(_entityClass, _options) {
        return { query: 'SELECT 1', parameters: [] };
    }
}
class CapturingEntityCache {
    constructor() {
        this.gets = [];
        this.sets = [];
        this.store = new Map();
    }
    k(entityClass, id) {
        return `${entityClass.name}|${id}`;
    }
    get(entityClass, id) {
        this.gets.push({ key: entityClass.name, id });
        return this.store.get(this.k(entityClass, id));
    }
    set(entityClass, id, entity) {
        this.sets.push({ key: entityClass.name, id });
        this.store.set(this.k(entityClass, id), entity);
    }
    remove(entityClass, id) {
        this.store.delete(this.k(entityClass, id));
    }
    clear() {
        this.store.clear();
    }
}
class E {
}
describe('L2 cache injection (EntityCacheLike)', () => {
    test('Queryable uses injected L2 cache when enabled', async () => {
        // register minimal metadata
        MetadataStorage_1.MetadataStorage.addEntity(E, 'e');
        MetadataStorage_1.MetadataStorage.addColumn(E, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false,
            isGenerated: true,
            isVersion: false
        });
        MetadataStorage_1.MetadataStorage.addPrimaryKey(E, 'id');
        MetadataStorage_1.MetadataStorage.getEntity(E);
        const provider = new ProviderStub('conn');
        // Override dialect to a dummy one via method override pattern
        provider.getDialect = () => new DummyDialect();
        const cache = new CapturingEntityCache();
        const q = new Queryable_1.Queryable(E, provider, undefined, cache, {
            enableEntityCache: true
        });
        await q.toArray();
        expect(cache.sets.length).toBeGreaterThanOrEqual(1);
        expect(cache.gets.length).toBeGreaterThanOrEqual(1);
    });
});
//# sourceMappingURL=l2-cache-injection.test.js.map