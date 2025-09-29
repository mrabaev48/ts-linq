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
    let PItem = class PItem {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], PItem.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], PItem.prototype, "name", void 0);
    PItem = __decorate([
        (0, src_1.Entity)()
    ], PItem);
    return { PItem };
}
class PContext extends src_1.DbContext {
    constructor() {
        super({
            provider: new ProviderStub_1.ProviderStub(':memory:'),
            connectionString: ':memory:'
        });
    }
}
describe('Pagination helpers', () => {
    let ctx;
    let PItem;
    beforeEach(async () => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        const e = defineEntities();
        PItem = e.PItem;
        ctx = new PContext();
        await ctx.ensureCreated();
        // seed 10 items
        for (let i = 1; i <= 10; i++) {
            const it = new PItem();
            it.name = `N${i}`;
            ctx.set(PItem).add(it);
            await ctx.saveChanges();
        }
    });
    afterEach(async () => {
        await ctx.dispose();
    });
    it('paginate(page,size) returns correct slice and total', async () => {
        const page = await ctx
            .set(PItem)
            .orderBy((x) => x.id)
            .paginate(2, 3);
        expect(page.page).toBe(2);
        expect(page.size).toBe(3);
        expect(page.total).toBe(10);
        expect(page.items.map((i) => i.name)).toEqual(['N4', 'N5', 'N6']);
    });
    it('keysetPaginate(key, after, size) returns correct window and nextAfter', async () => {
        const q = ctx
            .set(PItem)
            .orderBy((x) => x.id);
        const p1 = await q.keysetPaginate('id', null, 4);
        expect(p1.items).toHaveLength(4);
        expect(p1.items[0].name).toBe('N1');
        const p2 = await q.keysetPaginate('id', p1.nextAfter, 4);
        expect(p2.items.map((i) => i.name)).toEqual(['N5', 'N6', 'N7', 'N8']);
    });
});
//# sourceMappingURL=pagination.test.js.map