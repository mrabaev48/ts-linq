import 'reflect-metadata';
import { SQLiteDdlStrategy } from '@ts-linq/sqlite';
import { PostgresDdlStrategy } from '@ts-linq/postgres';
import { MySqlDdlStrategy } from '@ts-linq/mysql';
import { MssqlDdlStrategy } from '@ts-linq/mssql';

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
