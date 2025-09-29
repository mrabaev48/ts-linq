"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const MigrationBuilder_1 = require("../../src/migrations/MigrationBuilder");
describe('DDL Builder (smoke)', () => {
    it('produces up/down arrays for a target dialect', () => {
        const mb = new MigrationBuilder_1.MigrationBuilder();
        mb.createTable('smoke_users', (t) => {
            t.column('id', 'INTEGER', { nullable: false }).primaryKey('id');
            t.column('name', 'TEXT', { nullable: false });
        });
        mb.dropTable('smoke_users');
        const pg = mb.toSql('postgresql');
        expect(Array.isArray(pg.up)).toBe(true);
        expect(Array.isArray(pg.down)).toBe(true);
        expect(pg.up.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=ddl-builder.test.js.map