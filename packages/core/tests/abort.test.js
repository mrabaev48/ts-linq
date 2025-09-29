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
const ProviderStub_1 = require("./_stubs/ProviderStub");
const Entity_1 = require("../src/decorators/Entity");
const PrimaryKey_1 = require("../src/decorators/PrimaryKey");
const Column_1 = require("../src/decorators/Column");
let A = class A {
};
__decorate([
    (0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }),
    __metadata("design:type", Number)
], A.prototype, "id", void 0);
__decorate([
    (0, Column_1.Column)({ type: 'TEXT' }),
    __metadata("design:type", String)
], A.prototype, "name", void 0);
A = __decorate([
    (0, Entity_1.Entity)({ name: 'A' })
], A);
class Ctx extends DbContext_1.DbContext {
    constructor() {
        super({
            connectionString: ':memory:',
            provider: new ProviderStub_1.ProviderStub(':memory:')
        });
    }
}
describe('Abortable queries', () => {
    test('withAbort throws when signal is already aborted', async () => {
        new A();
        const ctx = new Ctx();
        await ctx.ensureCreated();
        const c = new AbortController();
        c.abort();
        await expect(ctx
            .set(A)
            .where((x) => x.id > 0)
            .withAbort(c.signal)
            .toArray()).rejects.toThrow('Operation aborted');
        await ctx.dispose();
    });
});
//# sourceMappingURL=abort.test.js.map