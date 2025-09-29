"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MigrationBuilder_1 = require("../src/migrations/MigrationBuilder");
const DialectMigrationSql_1 = require("../src/migrations/DialectMigrationSql");
describe('MigrationBuilder', () => {
    test('produces SchemaDiff and SQL for simple create/index/drop', () => {
        const mb = new MigrationBuilder_1.MigrationBuilder()
            .createTable('users', (t) => {
            t.column('id', 'INTEGER', { nullable: false }).column('name', 'TEXT');
            t.primaryKey('id');
            t.index('idx_users_name', ['name']);
        })
            .dropTable('old_table');
        const diff = mb.toDiff();
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'sqlite');
        expect(up.some((s) => s.startsWith('CREATE TABLE'))).toBeTruthy();
        expect(up.some((s) => s.includes('CREATE INDEX'))).toBeTruthy();
        expect(up.some((s) => s.startsWith('DROP TABLE old_table'))).toBeTruthy();
    });
    test('supports foreign keys in create table', () => {
        const mb = new MigrationBuilder_1.MigrationBuilder().createTable('orders', (t) => {
            t.column('id', 'INTEGER', { nullable: false }).primaryKey('id');
            t.column('user_id', 'INTEGER', { nullable: false });
            t.foreignKey({
                name: 'fk_orders_users',
                columns: ['user_id'],
                refTable: 'users',
                refColumns: ['id'],
                onDelete: 'CASCADE',
                onUpdate: 'NO ACTION'
            });
        });
        const { up } = mb.toSql('postgresql');
        const createSql = up.find((s) => s.startsWith('CREATE TABLE'));
        expect(createSql).toContain('FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION');
    });
    test('alterTable add/alter/drop column generates SQL', () => {
        const mb = new MigrationBuilder_1.MigrationBuilder().alterTable('users', (t) => {
            t.addColumn('age', 'INTEGER', { nullable: false, defaultValue: 0 });
            t.alterColumn('name', 'TEXT', { nullable: false });
            t.dropColumn('legacy');
        });
        const { up } = mb.toSql('postgresql');
        expect(up.some((s) => s.startsWith('ALTER TABLE "users" ADD COLUMN'))).toBeTruthy();
        expect(up.some((s) => s.includes('ALTER TABLE "users" ALTER COLUMN "name"'))).toBeTruthy();
        // Drop column for non-sqlite dialects
        expect(up.some((s) => s.startsWith('ALTER TABLE "users" DROP COLUMN "legacy"'))).toBeTruthy();
    });
    test('create/drop index generates SQL', () => {
        const mb = new MigrationBuilder_1.MigrationBuilder()
            .createIndex('users', 'idx_users_name', ['name'])
            .dropIndex('users', 'idx_old');
        const { up } = mb.toSql('postgresql');
        expect(up.some((s) => s.startsWith('CREATE INDEX "idx_users_name" ON "users"'))).toBeTruthy();
        expect(up.some((s) => /DROP\s+INDEX/i.test(s))).toBeTruthy();
    });
});
//# sourceMappingURL=migration-builder.test.js.map