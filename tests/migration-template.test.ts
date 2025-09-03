import 'reflect-metadata';
import { generateMigrationClassSource } from '../src/migrations/MigrationTemplate';
import { SchemaDiff } from '../src/migrations/DiffTypes';

describe('MigrationTemplate', () => {
  it('generates a TS class with up/down', () => {
    const diff: SchemaDiff = { tables: [{ table: 'Users', create: { name: 'Users', columns: [{ name: 'id', type: 'INTEGER', nullable: false } as any], primaryKeys: ['id'], indexes: [], foreignKeys: [] } as any }] };
    const src = generateMigrationClassSource(diff, { className: 'CreateUsers', version: '001', dialect: 'postgresql' });
    expect(src.includes('class CreateUsers extends Migration')).toBe(true);
    expect(src.includes('await provider.executeNonQuery')).toBe(true);
    expect(src.includes('CREATE TABLE IF NOT EXISTS')).toBe(true);
  });
});


