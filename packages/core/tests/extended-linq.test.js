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
const ProviderStub_1 = require("./_stubs/ProviderStub");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
function defineEntities() {
    let A = class A {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], A.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], A.prototype, "name", void 0);
    A = __decorate([
        (0, src_1.Entity)()
    ], A);
    let B = class B {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], B.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'INTEGER', nullable: false }),
        __metadata("design:type", Number)
    ], B.prototype, "aId", void 0);
    B = __decorate([
        (0, src_1.Entity)()
    ], B);
    return { A, B };
}
class Ctx extends src_1.DbContext {
    constructor() {
        super({ provider: new ProviderStub_1.ProviderStub(':memory:'), connectionString: ':memory:' });
    }
}
describe('Extended LINQ: subqueries and unions', () => {
    let ctx;
    let A;
    let B;
    beforeEach(async () => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        const e = defineEntities();
        A = e.A;
        B = e.B;
        ctx = new Ctx();
        await ctx.ensureCreated();
        const a1 = new A();
        a1.name = 'x';
        const a2 = new A();
        a2.name = 'y';
        ctx.set(A).add(a1);
        ctx.set(A).add(a2);
        await ctx.saveChanges();
        const b1 = new B();
        b1.aId = a1.id;
        ctx.set(B).add(b1);
        await ctx.saveChanges();
    });
    afterEach(async () => {
        await ctx.dispose();
    });
    it('whereInSubquery selects As that have Bs', async () => {
        const sub = ctx
            .set(B)
            .where(() => true)
            .select((b) => ({ aId: b.aId })).raw;
        const result = await ctx.set(A).whereInSubquery('id', sub).toArray();
        expect(result.length).toBe(1);
    });
    it('union and unionAll basic', async () => {
        const q1 = ctx.set(A).where((a) => a.name === 'x').raw;
        const q2 = ctx.set(A).where((a) => a.name === 'y').raw;
        const res = await q1.union(q2).toArray();
        expect(res.length).toBe(2);
    });
});
//# sourceMappingURL=extended-linq.test.js.map