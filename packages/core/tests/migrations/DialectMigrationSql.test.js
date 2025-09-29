"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DialectMigrationSql_1 = require("../../src/migrations/DialectMigrationSql");
test('Index WHERE is rendered for PG/SQLite/MSSQL and ignored for MySQL', () => {
    const diff = {
        tables: [
            {
                table: 'Users',
                create: {
                    name: 'Users',
                    columns: [
                        { name: 'id', type: 'INTEGER', nullable: false },
                        { name: 'active', type: 'INTEGER', nullable: false }
                    ],
                    primaryKeys: ['id'],
                    indexes: [
                        { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
                    ],
                    foreignKeys: []
                }
            }
        ]
    };
    const pg = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up.join('\n');
    expect(pg).toContain('CREATE INDEX "idx_users_active" ON "Users" ("active") WHERE active = 1');
    const sqlite = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'sqlite').up.join('\n');
    expect(sqlite).toContain('CREATE INDEX idx_users_active ON Users (active) WHERE active = 1');
    const mssql = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mssql').up.join('\n');
    expect(mssql).toContain('CREATE INDEX [idx_users_active] ON [Users] ([active]) WHERE active = 1');
    const mysql = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up.join('\n');
    expect(mysql).toContain('CREATE INDEX `idx_users_active` ON `Users` (`active`)');
    expect(mysql).not.toContain('WHERE active = 1');
});
test('Index drop+create for altered options (orders) on Postgres', () => {
    const diff = {
        tables: [
            {
                table: 'Users',
                indexDrops: ['idx_users_email'],
                indexCreates: [
                    { name: 'idx_users_email', columns: ['email'], unique: false, orders: { email: 'DESC' } }
                ]
            }
        ]
    };
    const res = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up.join('\n');
    expect(res).toContain('DROP INDEX IF EXISTS "idx_users_email"');
    expect(res).toContain('CREATE INDEX "idx_users_email" ON "Users" ("email" DESC)');
});
test('Add column with defaultExpression in Postgres', () => {
    const diff = {
        tables: [
            {
                table: 'Users',
                columnChanges: [
                    {
                        kind: 'add',
                        column: {
                            name: 'createdAt',
                            type: 'DATETIME',
                            nullable: false,
                            defaultExpression: 'CURRENT_TIMESTAMP'
                        }
                    }
                ]
            }
        ]
    };
    const res = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up.join('\n');
    expect(res).toContain('ALTER TABLE "Users" ADD COLUMN "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
});
//# sourceMappingURL=DialectMigrationSql.test.js.map