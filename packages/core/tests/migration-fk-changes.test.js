"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DialectMigrationSql_1 = require("../src/migrations/DialectMigrationSql");
describe('FK add/drop SQL generation', () => {
    test('postgres add/drop fk', () => {
        const diff = {
            tables: [
                {
                    table: 'orders',
                    fkCreates: [
                        {
                            name: 'fk_orders_users',
                            columns: ['user_id'],
                            refTable: 'users',
                            refColumns: ['id'],
                            onDelete: 'CASCADE'
                        }
                    ]
                },
                { table: 'orders', fkDrops: ['fk_old'] }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql');
        expect(up.some((s) => s.includes('ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_users" FOREIGN KEY'))).toBeTruthy();
        expect(up.some((s) => s.includes('DROP CONSTRAINT "fk_old"'))).toBeTruthy();
    });
    test('mysql add/drop fk', () => {
        const diff = {
            tables: [
                {
                    table: 'orders',
                    fkCreates: [{ columns: ['user_id'], refTable: 'users', refColumns: ['id'] }]
                },
                { table: 'orders', fkDrops: ['fk_old'] }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql');
        expect(up.some((s) => s.includes('ALTER TABLE `orders` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)'))).toBeTruthy();
        expect(up.some((s) => s.includes('DROP FOREIGN KEY `fk_old`'))).toBeTruthy();
    });
    test('sqlite emits comments for fk add/drop', () => {
        const diff = {
            tables: [
                {
                    table: 'orders',
                    fkCreates: [{ columns: ['user_id'], refTable: 'users', refColumns: ['id'] }]
                },
                { table: 'orders', fkDrops: ['fk_old'] }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'sqlite');
        expect(up.some((s) => s.startsWith('-- SQLite requires table rebuild'))).toBeTruthy();
    });
});
//# sourceMappingURL=migration-fk-changes.test.js.map