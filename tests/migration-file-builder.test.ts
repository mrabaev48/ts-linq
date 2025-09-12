import { MigrationFileBuilder } from '../src/migrations/MigrationFileBuilder';
import type { SchemaDiff } from '../src/migrations/DiffTypes';

describe('MigrationFileBuilder', () => {
  test('builds TS migration class from diff', () => {
    const diff: SchemaDiff = {
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

    const { filename, source } = MigrationFileBuilder.build(diff, {
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
