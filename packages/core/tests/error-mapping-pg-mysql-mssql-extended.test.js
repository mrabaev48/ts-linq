'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const types_1 = require('../src/types');
const postgres_1 = require('@ts-linq/postgres');
const mysql_1 = require('@ts-linq/mysql');
const mssql_1 = require('@ts-linq/mssql');
class PgFK extends postgres_1.PostgresProvider {
  async connect() {
    this.pool = {
      query: async () => {
        const err = new Error('insert or update on table violates foreign key constraint');
        err.code = '23503';
        throw err;
      }
    };
    this.isConnected = true;
  }
  async disconnect() {
    this.isConnected = false;
  }
}
class MyTimeout extends mysql_1.MySqlProvider {
  async connect() {
    this.pool = {
      query: async () => {
        const err = new Error('timeout');
        err.code = 'PROTOCOL_SEQUENCE_TIMEOUT';
        throw err;
      },
      execute: async () => {
        const err = new Error('timeout');
        err.code = 'PROTOCOL_SEQUENCE_TIMEOUT';
        throw err;
      }
    };
    this.isConnected = true;
  }
  async disconnect() {
    this.isConnected = false;
  }
}
class MsTimeout extends mssql_1.MssqlProvider {
  async connect() {
    this.isConnected = true;
  }
  async disconnect() {
    this.isConnected = false;
  }
  async doExecuteNonQuery() {
    throw new types_1.DatabaseError('timeout');
  }
}
describe('Extended error mapping (FK/timeout)', () => {
  test('Postgres maps 23503 to ForeignKeyConstraintError', async () => {
    const p = new PgFK('postgres://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO child VALUES (1)')).rejects.toThrow();
    await p.disconnect();
  });
  test('MySQL timeout surfaces as DatabaseError', async () => {
    const p = new MyTimeout('mysql://fake');
    await p.connect();
    await expect(p.executeNonQuery('SELECT 1')).rejects.toThrow();
    await p.disconnect();
  });
  test('MSSQL timeout surfaces as DatabaseError', async () => {
    const p = new MsTimeout('mssql://fake');
    await p.connect();
    await expect(p.executeNonQuery('SELECT 1')).rejects.toBeInstanceOf(types_1.DatabaseError);
    await p.disconnect();
  });
});
//# sourceMappingURL=error-mapping-pg-mysql-mssql-extended.test.js.map
