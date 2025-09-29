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
const Entity_1 = require("../src/decorators/Entity");
const PrimaryKey_1 = require("../src/decorators/PrimaryKey");
const Column_1 = require("../src/decorators/Column");
const types_1 = require("../src/types");
let ValUser = class ValUser {
};
__decorate([
    (0, PrimaryKey_1.PrimaryKey)({ autoIncrement: true }),
    __metadata("design:type", Number)
], ValUser.prototype, "id", void 0);
__decorate([
    (0, Column_1.Column)({ type: 'TEXT', nullable: false, length: 5 }),
    __metadata("design:type", String)
], ValUser.prototype, "name", void 0);
ValUser = __decorate([
    (0, Entity_1.Entity)({ name: 'ValUsers' })
], ValUser);
class ValCtx extends DbContext_1.DbContext {
    constructor() {
        const { ProviderStub } = require('./_stubs/ProviderStub');
        super({ provider: new ProviderStub(':memory:') });
    }
}
describe('Model validation', () => {
    test('saveChanges throws ValidationError on null and length violations', async () => {
        new ValUser();
        const ctx = new ValCtx();
        await ctx.ensureCreated();
        const u = new ValUser();
        // name is required
        ctx.set(ValUser).add(u);
        await expect(ctx.saveChanges()).rejects.toBeInstanceOf(types_1.ValidationError);
        // fix null but exceed length
        u.name = 'too-long-name';
        await expect(ctx.saveChanges()).rejects.toBeInstanceOf(types_1.ValidationError);
        await ctx.dispose();
    });
    test('trySaveChanges returns Result with error', async () => {
        new ValUser();
        const ctx = new ValCtx();
        await ctx.ensureCreated();
        const u = new ValUser();
        ctx.set(ValUser).add(u);
        const res = await ctx.trySaveChanges();
        expect(res.ok).toBe(false);
        await ctx.dispose();
    });
});
//# sourceMappingURL=validation.test.js.map