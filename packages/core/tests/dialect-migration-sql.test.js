"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const DialectMigrationSql_1 = require("../src/migrations/DialectMigrationSql");
const baseDiff = {
    tables: [
        {
            table: 'Users',
            columnChanges: [{ kind: 'add', column: { name: 'age', type: 'INTEGER', nullable: true } }]
        }
    ]
};
describe('Dialect migration SQL', () => {
    it('postgresql add column + create table snapshot', () => {
        const diff = {
            tables: [
                {
                    table: 'Users',
                    create: {
                        name: 'Users',
                        columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
                        primaryKeys: ['id'],
                        indexes: [],
                        foreignKeys: []
                    }
                },
                ...baseDiff.tables
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql');
        const expected = 'CREATE TABLE IF NOT EXISTS "Users" ("id" INTEGER NOT NULL, PRIMARY KEY ("id"))\nALTER TABLE "Users" ADD COLUMN "age" INTEGER';
        expect(up.join('\n')).toBe(expected);
    });
    it('mysql add column', () => {
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(baseDiff, 'mysql');
        expect(up[0]).toBe('ALTER TABLE `Users` ADD COLUMN `age` INT');
    });
    it('mssql add column', () => {
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(baseDiff, 'mssql');
        expect(up[0]).toBe('ALTER TABLE [Users] ADD [age] INT');
    });
    it('alter type/null (postgresql)', () => {
        const diff = {
            tables: [
                {
                    table: 'Users',
                    columnChanges: [
                        {
                            kind: 'alter',
                            column: { name: 'age', type: 'TEXT', nullable: false },
                            prev: { name: 'age', type: 'INTEGER', nullable: true }
                        }
                    ]
                }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql');
        expect(up).toEqual([
            'ALTER TABLE "Users" ALTER COLUMN "age" TYPE TEXT',
            'ALTER TABLE "Users" ALTER COLUMN "age" SET NOT NULL'
        ]);
    });
    it('drop table emits DROP TABLE (all dialects)', () => {
        const diff = { tables: [{ table: 'Obsolete', drop: true }] };
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql').up[0]).toBe('DROP TABLE "Obsolete"');
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up[0]).toBe('DROP TABLE `Obsolete`');
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mssql').up[0]).toBe('DROP TABLE [Obsolete]');
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'sqlite').up[0]).toBe('DROP TABLE Obsolete');
    });
    it('ADD COLUMN NOT NULL with DEFAULT (postgres/mysql/mssql/sqlite)', () => {
        const base = {
            tables: [
                {
                    table: 'Users',
                    columnChanges: [
                        {
                            kind: 'add',
                            column: {
                                name: 'active',
                                type: 'BOOLEAN',
                                nullable: false,
                                defaultValue: true
                            }
                        }
                    ]
                }
            ]
        };
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(base, 'postgresql').up[0]).toBe('ALTER TABLE "Users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT TRUE');
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(base, 'mysql').up[0]).toBe('ALTER TABLE `Users` ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 1');
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(base, 'mssql').up[0]).toBe('ALTER TABLE [Users] ADD [active] BIT NOT NULL DEFAULT 1');
        // sqlite: BOOLEAN→INTEGER, TRUE→1
        expect((0, DialectMigrationSql_1.generateMigrationFromDiff)(base, 'sqlite').up[0]).toBe('ALTER TABLE Users ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
    });
    it('alter nullability for mysql/mssql yields comment placeholder', () => {
        const diff = {
            tables: [
                {
                    table: 'Users',
                    columnChanges: [
                        {
                            kind: 'alter',
                            column: { name: 'age', type: 'INTEGER', nullable: false },
                            prev: { name: 'age', type: 'INTEGER', nullable: true }
                        }
                    ]
                }
            ]
        };
        const my = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql').up;
        const ms = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mssql').up;
        expect(my.some((s) => s.includes('MySQL requires full type'))).toBe(true);
        expect(ms.some((s) => s.includes('MSSQL requires full type'))).toBe(true);
    });
    it('FK in CREATE TABLE (postgresql)', () => {
        const diff = {
            tables: [
                {
                    table: 'Orders',
                    create: {
                        name: 'Orders',
                        columns: [
                            { name: 'id', type: 'INTEGER', nullable: false },
                            { name: 'userId', type: 'INTEGER', nullable: false }
                        ],
                        primaryKeys: ['id'],
                        indexes: [],
                        foreignKeys: [{ columns: ['userId'], refTable: 'Users', refColumns: ['id'] }]
                    }
                }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql');
        expect(up[0]).toBe('CREATE TABLE IF NOT EXISTS "Orders" ("id" INTEGER NOT NULL, "userId" INTEGER NOT NULL, PRIMARY KEY ("id"), FOREIGN KEY ("userId") REFERENCES "Users" ("id"))');
    });
});
//# sourceMappingURL=dialect-migration-sql.test.js.map