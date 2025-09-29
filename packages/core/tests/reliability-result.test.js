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
const DbContext_1 = require("../src/context/DbContext");
const DatabaseProvider_1 = require("../src/DatabaseProvider");
const Entity_1 = require("../src/decorators/Entity");
const Column_1 = require("../src/decorators/Column");
const PrimaryKey_1 = require("../src/decorators/PrimaryKey");
let Item = class Item {
};
__decorate([
    (0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }),
    __metadata("design:type", Number)
], Item.prototype, "id", void 0);
__decorate([
    (0, Column_1.Column)({ type: 'TEXT', nullable: false }),
    __metadata("design:type", String)
], Item.prototype, "name", void 0);
Item = __decorate([
    (0, Entity_1.Entity)({ name: 'Items' })
], Item);
class TestContext extends DbContext_1.DbContext {
    constructor() {
        const provider = new (class extends DatabaseProvider_1.DatabaseProvider {
            async connect() { }
            async disconnect() { }
            async createTable() { }
            getDialect() {
                return { buildSelect: () => ({ query: 'SELECT 1', parameters: [] }) };
            }
            async insert(e) {
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
                return [];
            }
            async findWhere() {
                return [];
            }
            async findWhereIn() {
                return [];
            }
            async doExecuteQuery() {
                return [];
            }
            async doExecuteNonQuery() {
                return 0;
            }
            async beginTransaction() { }
            async commitTransaction() { }
            async rollbackTransaction() { }
        })('');
        super({ provider });
    }
}
describe('Result-based try methods', () => {
    test('trySaveChanges returns ok on success', async () => {
        // Ensure metadata is rehydrated before context initialization
        new Item();
        const ctx = new TestContext();
        await ctx.ensureCreated();
        const item = new Item();
        item.name = 'ok';
        ctx.set(Item).add(item);
        const res = await ctx.trySaveChanges();
        expect(res.ok).toBe(true);
        if (res.ok)
            expect(res.value).toBeGreaterThan(0);
        await ctx.dispose();
    });
});
//# sourceMappingURL=reliability-result.test.js.map