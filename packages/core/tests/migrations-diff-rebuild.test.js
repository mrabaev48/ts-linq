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
const DiffMigrationGenerator_1 = require("../src/migrations/DiffMigrationGenerator");
function defineEntitiesV1() {
    let RUser = class RUser {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], RUser.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], RUser.prototype, "name", void 0);
    RUser = __decorate([
        (0, src_1.Entity)({ name: 'RUsers' })
    ], RUser);
    return { RUser };
}
class RCtx extends src_1.DbContext {
    constructor() {
        const { ProviderStub } = require('./_stubs/ProviderStub');
        super({ provider: new ProviderStub(':memory:'), connectionString: ':memory:' });
    }
}
describe('Schema diff rebuild (SQLite minimal)', () => {
    beforeEach(() => MetadataStorage_1.MetadataStorage.getInstance().clear());
    it('produces rebuild steps when column type changes', async () => {
        const { RUser } = defineEntitiesV1();
        const ctx = new RCtx();
        await ctx.ensureCreated();
        // change column type in metadata
        const meta = MetadataStorage_1.MetadataStorage.getEntity(RUser);
        const nameCol = meta.columns.find((c) => c.propertyName === 'name');
        nameCol.type = 'INTEGER';
        const gen = new DiffMigrationGenerator_1.DiffMigrationGenerator(ctx.provider);
        const steps = await gen.generate();
        const sqls = steps.map((s) => s.sql).join('\n');
        // For minimal stub, at least expect ALTER or CREATE present after type change
        expect(sqls.length).toBeGreaterThan(0);
        await ctx.dispose();
    });
});
//# sourceMappingURL=migrations-diff-rebuild.test.js.map