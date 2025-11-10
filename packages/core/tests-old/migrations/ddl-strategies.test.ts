import { SQLiteDdlStrategy } from '@ts-linq/provider-sqlite';
import { PostgresDdlStrategy } from '@ts-linq/provider-postgres';
import { MySqlDdlStrategy } from '@ts-linq/provider-mysql';
import { MssqlDdlStrategy } from '@ts-linq/provider-mssql';

describe('DDL Strategies (smoke)', () => {
  it('mapType to SQLite', () => {
    const s = new SQLiteDdlStrategy();
    expect(s.mapTypeToSQLite('TEXT')).toBeDefined();
  });
  it('create index sql in PG strategy contains name', () => {
    const s = new PostgresDdlStrategy();
    const sql = s.generateCreateIndexSql('t', { name: 'idx', columns: ['c'], unique: false });
    expect(sql).toContain('idx');
  });
  it('create index sql in MySQL strategy contains table', () => {
    const s = new MySqlDdlStrategy();
    const sql = s.generateCreateIndexSql('t', { name: 'idx', columns: ['c'], unique: false });
    expect(sql).toContain('t');
  });
  it('create index sql in MSSQL strategy contains table', () => {
    const s = new MssqlDdlStrategy();
    const sql = s.generateCreateIndexSql('t', { name: 'idx', columns: ['c'], unique: false });
    expect(sql).toContain('t');
  });
});
