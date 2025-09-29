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
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
function defineEntities() {
    let Item = class Item {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], Item.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], Item.prototype, "name", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'BOOLEAN', nullable: false, defaultValue: false }),
        __metadata("design:type", Boolean)
    ], Item.prototype, "isDeleted", void 0);
    Item = __decorate([
        (0, src_1.Entity)()
    ], Item);
    return { Item };
}
class Ctx extends src_1.DbContext {
    constructor(filters) {
        const provider = new (class extends DatabaseProvider_1.DatabaseProvider {
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
                        let query = `SELECT * FROM ${meta.tableName}`;
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
            async insert(e, entityClass) {
                const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
                const table = meta.tableName;
                const slot = this.tables.get(table);
                const pk = meta.primaryKeys[0];
                const copy = { ...e };
                if (pk && (copy[pk] === undefined || copy[pk] === null)) {
                    copy[pk] = (slot.rows.length ? slot.rows[slot.rows.length - 1][pk] || 0 : 0) + 1;
                    e[pk] = copy[pk];
                }
                slot.rows.push(copy);
                return e;
            }
            async update(e, entityClass) {
                const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
                const table = meta.tableName;
                const pk = meta.primaryKeys[0];
                const slot = this.tables.get(table);
                const idx = slot.rows.findIndex((r) => r[pk] === e[pk]);
                if (idx >= 0)
                    slot.rows[idx] = { ...e };
                return e;
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
            async doExecuteQuery(sql, params = []) {
                const from = /FROM\s+(\w+)/i.exec(sql);
                const slot = from ? this.tables.get(from[1]) : undefined;
                if (!slot)
                    return [];
                // handle simple soft-delete filter
                let rows = slot.rows.slice();
                if (/isDeleted\s*=\s*0/i.test(sql)) {
                    rows = rows.filter((r) => !r.isDeleted);
                }
                // handle simple name = ? filter
                const nameEq = /name\s*=\s*\?/i.test(sql);
                if (nameEq && params.length > 0) {
                    const needle = String(params[0]);
                    rows = rows.filter((r) => r.name === needle);
                }
                return rows;
            }
            async doExecuteNonQuery() {
                return 0;
            }
            async beginTransaction() { }
            async commitTransaction() { }
            async rollbackTransaction() { }
        })('');
        super({ provider, globalFilters: filters });
    }
}
describe('Global filters', () => {
    it('applies soft-delete filter to all queries', async () => {
        const { Item } = defineEntities();
        const ctx = new Ctx([{ entity: Item, where: { condition: 'isDeleted = 0', parameters: [] } }]);
        await ctx.ensureCreated();
        const a = new Item();
        a.name = 'A';
        a.isDeleted = false;
        const b = new Item();
        b.name = 'B';
        b.isDeleted = true;
        ctx.set(Item).add(a);
        ctx.set(Item).add(b);
        await ctx.saveChanges();
        const all = await ctx.set(Item).toArray();
        expect(all.map((x) => x.name)).toEqual(['A']);
        const maybe = await ctx
            .set(Item)
            .where((i) => i.name === 'B')
            .firstOrDefault();
        expect(maybe).toBeNull();
        await ctx.dispose();
    });
});
//# sourceMappingURL=global-filters.test.js.map