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
const QueryBuilder_1 = require("../src/query/QueryBuilder");
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const src_1 = require("../src");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
// Define test entity inside function to ensure decorators execute properly
function createQueryTestEntity() {
    let QueryTestEntity = class QueryTestEntity {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], QueryTestEntity.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)(),
        __metadata("design:type", String)
    ], QueryTestEntity.prototype, "name", void 0);
    __decorate([
        (0, src_1.Column)(),
        __metadata("design:type", Number)
    ], QueryTestEntity.prototype, "age", void 0);
    QueryTestEntity = __decorate([
        (0, src_1.Entity)()
    ], QueryTestEntity);
    return QueryTestEntity;
}
describe('QueryBuilder (SQL generation only)', () => {
    let provider;
    let queryBuilder;
    let QueryTestEntity;
    beforeEach(async () => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        // Create test entity
        QueryTestEntity = createQueryTestEntity();
        // In-memory stub provider: only SELECT used
        provider = new (class extends DatabaseProvider_1.DatabaseProvider {
            constructor() {
                super(...arguments);
                this.data = [];
                this.seq = 0;
            }
            async connect() { }
            async disconnect() { }
            async createTable() { }
            getDialect() {
                return {};
            }
            async insert(e) {
                const rec = { ...e };
                if (rec.id === undefined || rec.id === null)
                    rec.id = ++this.seq;
                this.data.push(rec);
                return e;
            }
            async update(e) {
                return e;
            }
            async delete() { }
            async findById() {
                return null;
            }
            async findAll() {
                return this.data.slice();
            }
            async findWhere() {
                return this.data.slice();
            }
            async findWhereIn() {
                return this.data.slice();
            }
            async doExecuteQuery(sql) {
                const limit = /LIMIT\s+(\d+)/i.exec(sql)?.[1];
                const offset = /OFFSET\s+(\d+)/i.exec(sql)?.[1];
                let rows = this.data.slice();
                const orderMatch = /ORDER BY\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(ASC|DESC)/i.exec(sql);
                if (orderMatch) {
                    const col = orderMatch[1];
                    const dir = orderMatch[2].toUpperCase();
                    rows.sort((a, b) => (a[col] === b[col] ? 0 : a[col] < b[col] ? -1 : 1));
                    if (dir === 'DESC')
                        rows.reverse();
                }
                if (offset)
                    rows = rows.slice(Number(offset));
                if (limit)
                    rows = rows.slice(0, Number(limit));
                return rows;
            }
            async doExecuteNonQuery(sql) {
                if (/^\s*DELETE\s+FROM\s+QueryTestEntity/i.test(sql)) {
                    const n = this.data.length;
                    this.data = [];
                    return n;
                }
                return 0;
            }
            async beginTransaction() { }
            async commitTransaction() { }
            async rollbackTransaction() { }
        })('');
        // Seed data
        for (let i = 1; i <= 10; i++) {
            const entity = new QueryTestEntity();
            entity.name = `Name ${i}`;
            entity.age = 20 + i;
            await provider.insert(entity, QueryTestEntity);
        }
        const mockDialect = {
            buildSelect: (ctor, opts) => {
                const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
                let query = `SELECT ${opts.distinct ? 'DISTINCT ' : ''}${opts.select?.length ? opts.select.join(', ') : '*'}`;
                query += ` FROM ${meta.tableName}`;
                const parameters = [];
                if (opts.where && opts.where.length) {
                    query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
                    for (const w of opts.where)
                        parameters.push(...w.parameters);
                }
                if (opts.orderBy && opts.orderBy.length) {
                    query += ' ORDER BY ' + opts.orderBy.map((o) => `${o.column} ${o.direction}`).join(', ');
                }
                const hasLimit = opts.limit !== undefined && opts.limit !== null;
                const hasOffset = opts.offset !== undefined && opts.offset !== null;
                if (hasLimit) {
                    query += ` LIMIT ${opts.limit}`;
                    if (hasOffset)
                        query += ` OFFSET ${opts.offset}`;
                }
                else if (hasOffset) {
                    query += ` LIMIT -1 OFFSET ${opts.offset}`;
                }
                return { query, parameters };
            }
        };
        queryBuilder = new QueryBuilder_1.QueryBuilder(mockDialect);
    });
    afterEach(async () => {
        await provider.disconnect();
    });
    describe('basic operations', () => {
        it('should return all entities with toArray', async () => {
            const sql = queryBuilder.generateSql(QueryTestEntity, {});
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results).toHaveLength(10);
        });
        it('should count entities', async () => {
            const sql = queryBuilder.generateSql(QueryTestEntity, {});
            const results = await provider.executeQuery(sql.query, sql.parameters);
            const count = results.length;
            expect(count).toBe(10);
        });
        it('should check if any entities exist', async () => {
            const sql = queryBuilder.generateSql(QueryTestEntity, {});
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results.length > 0).toBe(true);
        });
    });
    describe('take and skip', () => {
        it('should limit results with take', async () => {
            const opts = { limit: 5 };
            const sql = queryBuilder.generateSql(QueryTestEntity, opts);
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results).toHaveLength(5);
        });
        it('should skip results', async () => {
            const opts = { offset: 5 };
            const sql = queryBuilder.generateSql(QueryTestEntity, opts);
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results).toHaveLength(5);
        });
        it('should combine take and skip for pagination', async () => {
            const opts = { offset: 3, limit: 2 };
            const sql = queryBuilder.generateSql(QueryTestEntity, opts);
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results).toHaveLength(2);
        });
    });
    describe('ordering', () => {
        it('should order by ascending', async () => {
            const sql = queryBuilder.generateSql(QueryTestEntity, {
                orderBy: [{ column: 'age', direction: 'ASC' }]
            });
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results[0].age).toBeLessThan(results[1].age);
        });
        it('should order by descending', async () => {
            const sql = queryBuilder.generateSql(QueryTestEntity, {
                orderBy: [{ column: 'age', direction: 'DESC' }]
            });
            const results = await provider.executeQuery(sql.query, sql.parameters);
            expect(results[0].age).toBeGreaterThan(results[1].age);
        });
    });
    describe('first operations (via SQL generation)', () => {
        it('should get first row using LIMIT 1', async () => {
            const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {
                orderBy: [{ column: 'id', direction: 'ASC' }],
                limit: 1
            });
            const rows = await provider.executeQuery(query, parameters);
            expect(rows).toHaveLength(1);
            expect(rows[0].id).toBe(1);
        });
        it('should return empty when no results with LIMIT 1', async () => {
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, { limit: 1 });
            const rows = await provider.executeQuery(query, parameters);
            expect(rows).toHaveLength(0);
        });
    });
    describe('single-like checks (via SQL generation)', () => {
        it('should get one row when only one exists', async () => {
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            const entity = new QueryTestEntity();
            entity.name = 'Single';
            entity.age = 25;
            await provider.insert(entity, QueryTestEntity);
            const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
            const rows = await provider.executeQuery(query, parameters);
            expect(rows).toHaveLength(1);
            expect(rows[0].name).toBe('Single');
        });
        it('should return zero rows when none exist', async () => {
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
            const rows = await provider.executeQuery(query, parameters);
            expect(rows).toHaveLength(0);
        });
        it('should return multiple rows when multiple exist', async () => {
            const { query, parameters } = queryBuilder.generateSql(QueryTestEntity, {});
            const rows = await provider.executeQuery(query, parameters);
            expect(rows.length).toBeGreaterThan(1);
        });
    });
    describe('distinct', () => {
        it('should generate DISTINCT select', async () => {
            const { query } = queryBuilder.generateSql(QueryTestEntity, { distinct: true });
            expect(query.toUpperCase()).toContain('SELECT DISTINCT');
        });
    });
});
//# sourceMappingURL=query-builder.test.js.map