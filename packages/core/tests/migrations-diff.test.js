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
const DiffMigrationGenerator_1 = require("../src/migrations/DiffMigrationGenerator");
function defineEntities() {
    let DUser = class DUser {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], DUser.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], DUser.prototype, "name", void 0);
    DUser = __decorate([
        (0, src_1.Entity)({ name: 'DUsers' })
    ], DUser);
    return { DUser };
}
class DCtx extends src_1.DbContext {
    constructor() {
        super({
            provider: new ProviderStub_1.ProviderStub(':memory:'),
            connectionString: ':memory:'
        });
    }
}
describe('Schema diff migration (SQLite minimal)', () => {
    beforeEach(() => MetadataStorage_1.MetadataStorage.getInstance().clear());
    it('generates CREATE TABLE or ADD COLUMN steps', async () => {
        const { DUser } = defineEntities();
        const ctx = new DCtx();
        await ctx.ensureCreated();
        const gen = new DiffMigrationGenerator_1.DiffMigrationGenerator(ctx.provider);
        const steps = await gen.generate();
        expect(Array.isArray(steps)).toBe(true);
        // Since provider.createTable was used during ensureCreated, table exists, so steps may be empty or ALTERs
        // We add a new property to force ADD COLUMN
        MetadataStorage_1.MetadataStorage.getEntity(DUser).columns.push({
            propertyName: 'age',
            columnName: 'age',
            type: 'INTEGER',
            nullable: true
        });
        const steps2 = await gen.generate();
        expect(steps2.some((s) => /ALTER TABLE DUsers ADD COLUMN age/i.test(s.sql))).toBe(true);
        await ctx.dispose();
    });
});
//# sourceMappingURL=migrations-diff.test.js.map