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
// Re-export convenience decorators to avoid path confusion in tests
// Some tests import from '../src', but here we import directly to be explicit
function defineUserEntity() {
    let User = class User {
    };
    __decorate([
        (0, src_1.PrimaryKey)({ autoIncrement: true }),
        __metadata("design:type", Number)
    ], User.prototype, "id", void 0);
    __decorate([
        (0, src_1.Column)({ type: 'TEXT', nullable: false }),
        __metadata("design:type", String)
    ], User.prototype, "name", void 0);
    User = __decorate([
        (0, src_1.Entity)()
    ], User);
    return User;
}
describe('OrmMiddleware pipeline', () => {
    let provider;
    let User;
    const beforeCalls = [];
    const afterCalls = [];
    const materialized = [];
    const mw = {
        beforeExecute: ({ sql, params }) => {
            beforeCalls.push({ sql, params });
        },
        afterExecute: ({ sql, params, durationMs, rows }) => {
            afterCalls.push({ sql, params, durationMs, rows });
        },
        entityMaterialized: ({ entity }) => {
            materialized.push(entity);
        }
    };
    beforeEach(async () => {
        src_1.MetadataStorage.getInstance().clear();
        User = defineUserEntity();
        provider = new ProviderStub_1.ProviderStub(':memory:', undefined, [mw]);
        await provider.connect();
        beforeCalls.length = 0;
        afterCalls.length = 0;
        materialized.length = 0;
        await provider.createTable(src_1.MetadataStorage.getEntity(User));
    });
    afterEach(async () => {
        await provider.disconnect();
    });
    it('invokes before/after and entityMaterialized', async () => {
        const u = new User();
        u.name = 'Alice';
        await provider.insert(u, User);
        const all = await provider.findAll(User);
        expect(all).toHaveLength(1);
        // before/after should have been called at least once for DDL, INSERT, and SELECT
        expect(beforeCalls.length).toBeGreaterThanOrEqual(3);
        expect(afterCalls.length).toBeGreaterThanOrEqual(3);
        // afterExecute includes durationMs
        const lastAfter = afterCalls[afterCalls.length - 1];
        expect(typeof lastAfter.durationMs).toBe('number');
        expect(lastAfter.durationMs).toBeGreaterThanOrEqual(0);
        // entityMaterialized should be called for each row mapped
        expect(materialized.length).toBe(1);
        expect(materialized[0].name).toBe('Alice');
    });
});
//# sourceMappingURL=middleware.test.js.map