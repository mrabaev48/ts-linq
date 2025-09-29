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
const src_1 = require("../src");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
const DatabaseProvider_1 = require("../src/DatabaseProvider");
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
    constructor() {
        super(...arguments);
        this.tables = new Map();
    }
    async connect() { }
    async disconnect() { }
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
            buildSelect: (ctor, opts) => {
                const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
                const table = meta.tableName;
                let query = `SELECT * FROM ${table}`;
                const parameters = [];
                if (opts.where && opts.where.length) {
                    query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
                    for (const w of opts.where)
                        parameters.push(...w.parameters);
                }
                return { query, parameters };
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
    async doExecuteQuery(sql, params = []) {
        const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
        if (countMatch) {
            const table = countMatch[1];
            const slot = this.tables.get(table);
            const n = slot ? slot.rows.length : 0;
            return [{ count: n }];
        }
        const from = /FROM\s+(\w+)/i.exec(sql);
        if (from) {
            const table = from[1];
            const slot = this.tables.get(table);
            return slot?.rows.slice() || [];
        }
        return [];
    }
    async doExecuteNonQuery() {
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
function defineEntities() {
    let CItem = class CItem {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], CItem.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], CItem.prototype, "name", void 0);
    CItem = __decorate([
        (0, src_1.Entity)()
    ], CItem);
    return { CItem };
}
class Ctx extends src_1.DbContext {
    constructor(ttl) {
        const provider = new ProviderStub('');
        super({ provider, performance: { enableCountCache: true, countCacheTtlMs: ttl } });
    }
}
describe('count() cache TTL', () => {
    let CItem;
    beforeEach(() => MetadataStorage_1.MetadataStorage.getInstance().clear());
    it('returns cached value within TTL and refreshes after TTL', async () => {
        const e = defineEntities();
        CItem = e.CItem;
        const ctx = new Ctx(50);
        await ctx.ensureCreated();
        // seed 1
        const a = new CItem();
        a.name = 'A';
        ctx.set(CItem).add(a);
        await ctx.saveChanges();
        const q = ctx.set(CItem);
        const c1 = await q.count();
        expect(c1).toBe(1);
        // add more but read before TTL expires -> cached
        const b = new CItem();
        b.name = 'B';
        ctx.set(CItem).add(b);
        await ctx.saveChanges();
        const c2 = await q.count();
        expect(c2).toBe(1);
        // wait TTL then count should refresh
        await new Promise((res) => setTimeout(res, 70));
        const c3 = await q.count();
        expect(c3).toBe(2);
        await ctx.dispose();
    });
});
//# sourceMappingURL=count-cache.test.js.map