'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const DatabaseProvider_1 = require('../src/DatabaseProvider');
const sqlite_1 = require('@ts-linq/sqlite');
const mysql_1 = require('@ts-linq/mysql');
const postgres_1 = require('@ts-linq/postgres');
const mssql_1 = require('@ts-linq/mssql');
const sqlite_2 = require('@ts-linq/sqlite');
const mysql_2 = require('@ts-linq/mysql');
const postgres_2 = require('@ts-linq/postgres');
const mssql_2 = require('@ts-linq/mssql');
const Queryable_1 = require('../src/query/Queryable');
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
  getDialect() {
    return new sqlite_2.SQLiteDialect();
  }
  async connect() {}
  async disconnect() {}
  async createTable() {}
  async insert(entity) {
    return entity;
  }
  async update(entity) {
    return entity;
  }
  async delete() {}
  async findById() {
    return null;
  }
  async findAll() {
    return [];
  }
  async findWhere() {
    return [];
  }
  async findWhereIn() {
    return [];
  }
  async doExecuteQuery(_sql, _params) {
    return [];
  }
  async doExecuteNonQuery(_sql, _params) {
    return 0;
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {}
}
class DummyDialect {
  buildSelect() {
    return { query: 'SELECT /*DUMMY DIALECT*/ 1', parameters: [] };
  }
}
describe('DIP: provider → dialect wiring', () => {
  test('Concrete providers return their dialects', () => {
    const sqlite = new sqlite_1.SQLiteProvider(':memory:');
    const mysql = new mysql_1.MySqlProvider('mysql://user:pass@localhost/db');
    const pg = new postgres_1.PostgresProvider('postgres://user:pass@localhost/db');
    const mssql = new mssql_1.MssqlProvider('mssql://user:pass@localhost/db');
    expect(sqlite.getDialect()).toBeInstanceOf(sqlite_2.SQLiteDialect);
    expect(mysql.getDialect()).toBeInstanceOf(mysql_2.MysqlDialect);
    expect(pg.getDialect()).toBeInstanceOf(postgres_2.PostgresDialect);
    expect(mssql.getDialect()).toBeInstanceOf(mssql_2.MssqlDialect);
  });
  test('Base DatabaseProvider default getDialect returns SQLiteDialect', () => {
    const base = new ProviderStub('conn');
    expect(base.getDialect()).toBeInstanceOf(sqlite_2.SQLiteDialect);
  });
  test('Queryable uses provider.getDialect()', async () => {
    class DummyProvider extends ProviderStub {
      getDialect() {
        return new DummyDialect();
      }
      async doExecuteQuery(sql, _params) {
        this.capturedSql = sql;
        return [];
      }
    }
    class T {}
    const provider = new DummyProvider('conn');
    const q = new Queryable_1.Queryable(T, provider);
    await q.toArray();
    expect(provider.capturedSql).toContain('/*DUMMY DIALECT*/');
  });
});
//# sourceMappingURL=dip-dialect-wiring.test.js.map
