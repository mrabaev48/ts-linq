"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MigrationFileBuilder_1 = require("../src/migrations/MigrationFileBuilder");
describe('MigrationFileBuilder', () => {
    test('builds TS migration class from diff', () => {
        const diff = {
            tables: [
                {
                    table: 'users',
                    create: {
                        name: 'users',
                        columns: [
                            { name: 'id', type: 'INTEGER', nullable: false },
                            { name: 'name', type: 'TEXT', nullable: false }
                        ],
                        primaryKeys: ['id'],
                        indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false }],
                        foreignKeys: []
                    }
                }
            ]
        };
        const { filename, source } = MigrationFileBuilder_1.MigrationFileBuilder.build(diff, {
            className: 'CreateUsersTable',
            version: '001',
            dialect: 'sqlite'
        });
        expect(filename).toBe('001_CreateUsersTable.ts');
        expect(source).toContain('export class CreateUsersTable extends Migration');
        expect(source).toContain('await provider.executeNonQuery');
        expect(source).toContain('CREATE TABLE');
        expect(source).toContain('CREATE INDEX');
    });
});
//# sourceMappingURL=migration-file-builder.test.js.map