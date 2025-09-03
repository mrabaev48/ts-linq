import { DdlBuilder } from '../src/providers/DdlBuilder';
import { SQLiteDdlStrategy } from '../src/providers/sqlite/SQLiteDdlStrategy';
import { PostgresDdlStrategy } from '../src/providers/postgres/PostgresDdlStrategy';
import { EntityMetadata } from '../src/types';

const meta: EntityMetadata = {
  target: class U {},
  tableName: 'users',
  columns: [
    {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true,
      isVersion: false
    },
    { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false, isVersion: false }
  ],
  primaryKeys: ['id'],
  relationships: [],
  indexes: [{ name: 'idx_users_name', columns: ['name'], unique: false }]
};

describe('DdlBuilder', () => {
  test('builds SQLite table and index SQL', () => {
    const b = new DdlBuilder(new SQLiteDdlStrategy() as any);
    const all = b.buildAll(meta);
    expect(all.tableSql).toMatch(/^CREATE TABLE IF NOT EXISTS users/);
    expect(all.indexSqls[0]).toContain('CREATE INDEX');
  });

  test('builds Postgres table and index SQL', () => {
    const b = new DdlBuilder(new PostgresDdlStrategy() as any);
    const all = b.buildAll(meta);
    expect(all.tableSql).toMatch(/^CREATE TABLE IF NOT EXISTS/);
    expect(all.indexSqls[0]).toContain('CREATE INDEX');
  });
});
