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
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const src_1 = require("../src");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
const Queryable_1 = require("../src/query/Queryable");
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
    constructor() {
        super(...arguments);
        this.data = [];
    }
    async connect() { }
    async disconnect() { }
    async createTable() { }
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
    async insert(e) {
        this.data.push({ ...e });
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
    async doExecuteQuery(sql, params = []) {
        const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
        if (countMatch) {
            const n = this.data.length;
            return [{ count: n }];
        }
        const fromMatch = /FROM\s+(\w+)/i.exec(sql);
        if (fromMatch) {
            // Very naive WHERE parser for ">=" on age
            const geMatch = /WHERE\s+(\w+)\s*>\s*\?/i.exec(sql) || /WHERE\s+(\w+)\s*>=\s*\?/i.exec(sql);
            if (geMatch) {
                const col = geMatch[1];
                const val = Number(params[0]);
                return this.data.filter((r) => r[col] >= val);
            }
            return this.data.slice();
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
function createEntity() {
    let E = class E {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], E.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)(),
        __metadata("design:type", String)
    ], E.prototype, "name", void 0);
    __decorate([
        (0, src_1.Column)(),
        __metadata("design:type", Number)
    ], E.prototype, "age", void 0);
    E = __decorate([
        (0, src_1.Entity)()
    ], E);
    return E;
}
describe('Queryable', () => {
    let provider;
    let E;
    let q;
    beforeEach(async () => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        E = createEntity();
        provider = new ProviderStub('');
        for (let i = 1; i <= 3; i++) {
            const e = new E();
            e.name = `N${i}`;
            e.age = 20 + i;
            await provider.insert(e, E);
        }
        q = new Queryable_1.Queryable(E, provider);
    });
    afterEach(async () => {
        await provider.disconnect();
    });
    it('toArray returns all', async () => {
        const res = await q.toArray();
        expect(res).toHaveLength(3);
    });
    it('where with >= translates to SQL', async () => {
        const res = await q.where((e) => e.age >= 22).toArray();
        expect(res.every((x) => x.age >= 22)).toBe(true);
    });
});
//# sourceMappingURL=queryable.test.js.map