"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const QueryBuilder_1 = require("../src/query/QueryBuilder");
const EntityCache_1 = require("../src/utils/EntityCache");
const Queryable_1 = require("../src/query/Queryable");
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
class FakeDialect {
    constructor() {
        this.calls = 0;
    }
    buildSelect(entityClass, options) {
        this.calls++;
        return { query: 'SELECT 1', parameters: [1] };
    }
}
describe('Performance optimizations', () => {
    beforeEach(() => {
        // reset metadata and caches
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        QueryBuilder_1.QueryBuilder.clearCache();
    });
    test('QueryBuilder caches generated SQL per entity + options', () => {
        class Foo {
        }
        const dialect = new FakeDialect();
        const qb = new QueryBuilder_1.QueryBuilder(dialect);
        const options = { where: [{ condition: 'id = ?', parameters: [1] }] };
        const first = qb.generateSql(Foo, options);
        const second = qb.generateSql(Foo, options);
        expect(dialect.calls).toBe(1);
        expect(first.query).toBe('SELECT 1');
        expect(second.query).toBe('SELECT 1');
        expect(first.parameters).not.toBe(second.parameters); // cached clone
    });
    test('EntityCache stores and evicts by FIFO', () => {
        class User {
        }
        const cache = new EntityCache_1.EntityCache(2);
        cache.set(User, 1, { id: 1 });
        cache.set(User, 2, { id: 2 });
        expect(cache.get(User, 1)).toBeDefined();
        expect(cache.get(User, 2)).toBeDefined();
        cache.set(User, 3, { id: 3 }); // evict first
        expect(cache.get(User, 1)).toBeUndefined();
        expect(cache.get(User, 2)).toBeDefined();
        expect(cache.get(User, 3)).toBeDefined();
    });
    test('Queryable.count uses optional cache with TTL', async () => {
        class Product {
        }
        // Register minimal metadata for Product
        MetadataStorage_1.MetadataStorage.addEntity(Product, 'Products');
        MetadataStorage_1.MetadataStorage.addPrimaryKey(Product, 'id');
        MetadataStorage_1.MetadataStorage.addColumn(Product, {
            propertyName: 'id',
            columnName: 'id',
            type: 'INTEGER',
            nullable: false,
            isGenerated: true
        });
        MetadataStorage_1.MetadataStorage.addColumn(Product, {
            propertyName: 'name',
            columnName: 'name',
            type: 'TEXT',
            nullable: false
        });
        class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
            constructor() {
                super(...arguments);
                this.countCalls = 0;
            }
            async connect() {
                /* noop */
            }
            async disconnect() {
                /* noop */
            }
            async createTable() {
                /* noop */
            }
            async insert(entity) {
                return entity;
            }
            async update(entity) {
                return entity;
            }
            async delete() {
                /* noop */
            }
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
            async doExecuteQuery(sql) {
                if (sql.includes('COUNT(*)')) {
                    this.countCalls++;
                    return [{ count: 42 }];
                }
                return [];
            }
            async doExecuteNonQuery() {
                return 0;
            }
            getDialect() {
                return new FakeDialect();
            }
            async beginTransaction() {
                /* noop */
            }
            async commitTransaction() {
                /* noop */
            }
            async rollbackTransaction() {
                /* noop */
            }
        }
        const provider = new ProviderStub('memory');
        const perf = { enableCountCache: true, countCacheTtlMs: 50 };
        const q = new Queryable_1.Queryable(Product, provider, undefined, undefined, perf);
        const c1 = await q.count();
        const c2 = await q.count();
        expect(c1).toBe(42);
        expect(c2).toBe(42);
        expect(provider.countCalls).toBe(1); // second from cache
        await new Promise((res) => setTimeout(res, 60));
        const c3 = await q.count();
        expect(c3).toBe(42);
        expect(provider.countCalls).toBe(2); // expired, re-queried
    });
});
//# sourceMappingURL=performance.test.js.map