"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DialectMigrationSql_1 = require("../../src/migrations/DialectMigrationSql");
test('generateMigrationFromDiff: indexCreates/indexDrops (Postgres with WHERE)', () => {
    const diff = {
        tables: [
            {
                table: 'Users',
                indexCreates: [
                    { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
                ],
                indexDrops: ['idx_old']
            }
        ]
    };
    const res = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up.join('\n');
    expect(res).toContain('CREATE INDEX "idx_users_active" ON "Users" ("active") WHERE active = 1');
    expect(res).toContain('DROP INDEX IF EXISTS "idx_old"');
});
test('generateMigrationFromDiff: indexCreates/indexDrops (MySQL, WHERE ignored)', () => {
    const diff = {
        tables: [
            {
                table: 'Users',
                indexCreates: [
                    { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
                ],
                indexDrops: ['idx_old']
            }
        ]
    };
    const res = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up.join('\n');
    expect(res).toContain('CREATE INDEX `idx_users_active` ON `Users` (`active`)');
    expect(res).not.toContain('WHERE active = 1');
    expect(res).toContain('DROP INDEX `idx_old`');
});
//# sourceMappingURL=IndexDiff.test.js.map