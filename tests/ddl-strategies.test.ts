import { SQLiteDdlStrategy } from '../src/providers/sqlite/SQLiteDdlStrategy';
import { MySqlDdlStrategy } from '../src/providers/mysql/MySqlDdlStrategy';
import { MssqlDdlStrategy } from '../src/providers/mssql/MssqlDdlStrategy';
import { PostgresDdlStrategy } from '../src/providers/postgres/PostgresDdlStrategy';

const baseMeta = {
  target: function E() {},
  tableName: 'e',
  columns: [
    {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false,
      isGenerated: true,
      isVersion: false
    },
    {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false,
      isGenerated: false,
      isVersion: false
    }
  ],
  primaryKeys: ['id'],
  relationships: [],
  indexes: [{ name: 'idx_name', columns: ['name'], unique: false }]
};

describe('DDL strategies', () => {
  test('SQLiteDdlStrategy generates CREATE TABLE and INDEX', () => {
    const s = new SQLiteDdlStrategy();
    const sql = s.generateCreateTableSql(baseMeta);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS e \(/);
    const idx = s.generateCreateIndexSql('e', baseMeta.indexes[0]);
    expect(idx).toContain('CREATE INDEX IF NOT EXISTS idx_name ON e (name)');
  });

  test('MySqlDdlStrategy generates CREATE TABLE and INDEX', () => {
    const s = new MySqlDdlStrategy();
    const sql = s.generateCreateTableSql(baseMeta);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS e \(/);
    const idx = s.generateCreateIndexSql('e', baseMeta.indexes[0]);
    expect(idx).toContain('CREATE INDEX IF NOT EXISTS idx_name ON e (name)');
  });

  test('MssqlDdlStrategy generates CREATE TABLE and INDEX', () => {
    const s = new MssqlDdlStrategy();
    const sql = s.generateCreateTableSql(baseMeta);
    expect(sql).toContain("IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'e')");
    const idx = s.generateCreateIndexSql('e', baseMeta.indexes[0]);
    expect(idx).toContain('IF NOT EXISTS (SELECT * FROM sys.indexes');
  });

  test('PostgresDdlStrategy generates CREATE TABLE and INDEX', () => {
    const s = new PostgresDdlStrategy();
    const sql = s.generateCreateTableSql(baseMeta);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "e" \(/);
    const idx = s.generateCreateIndexSql('e', baseMeta.indexes[0]);
    expect(idx).toContain('CREATE INDEX IF NOT EXISTS "idx_name" ON "e" ("name")');
  });
});
