"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DialectMigrationSql_1 = require("../../src/migrations/DialectMigrationSql");
const diff = {
    tables: [
        {
            table: 'Users',
            indexDrops: ['idx_users_active']
        }
    ]
};
test('DROP INDEX SQL is dialect-specific', () => {
    const pg = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up.join('\n');
    expect(pg).toContain('DROP INDEX IF EXISTS "idx_users_active"');
    const sqlite = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'sqlite').up.join('\n');
    expect(sqlite).toContain('DROP INDEX IF EXISTS idx_users_active');
    const mysql = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up.join('\n');
    expect(mysql).toContain('ALTER TABLE `Users` DROP INDEX `idx_users_active`');
    const mssql = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mssql').up.join('\n');
    expect(mssql).toContain('DROP INDEX [idx_users_active] ON [Users]');
});
//# sourceMappingURL=IndexDropSql.test.js.map