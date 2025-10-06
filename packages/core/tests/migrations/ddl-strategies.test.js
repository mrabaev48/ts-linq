'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const sqlite_1 = require('@ts-linq/sqlite');
const postgres_1 = require('@ts-linq/postgres');
const mysql_1 = require('@ts-linq/mysql');
const mssql_1 = require('@ts-linq/mssql');
describe('DDL Strategies (smoke)', () => {
  it('mapType to SQLite', () => {
    const s = new sqlite_1.SQLiteDdlStrategy();
    expect(s.mapTypeToSQLite('TEXT')).toBeDefined();
  });
  it('create index sql in PG strategy contains name', () => {
    const s = new postgres_1.PostgresDdlStrategy();
    const sql = s.generateCreateIndexSql('t', { name: 'idx', columns: ['c'], unique: false });
    expect(sql).toContain('idx');
  });
  it('create index sql in MySQL strategy contains table', () => {
    const s = new mysql_1.MySqlDdlStrategy();
    const sql = s.generateCreateIndexSql('t', { name: 'idx', columns: ['c'], unique: false });
    expect(sql).toContain('t');
  });
  it('create index sql in MSSQL strategy contains table', () => {
    const s = new mssql_1.MssqlDdlStrategy();
    const sql = s.generateCreateIndexSql('t', { name: 'idx', columns: ['c'], unique: false });
    expect(sql).toContain('t');
  });
});
//# sourceMappingURL=ddl-strategies.test.js.map
