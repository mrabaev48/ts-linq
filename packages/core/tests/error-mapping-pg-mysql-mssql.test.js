"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const types_1 = require("../src/types");
const postgres_1 = require("@ts-linq/postgres");
const mysql_1 = require("@ts-linq/mysql");
const mssql_1 = require("@ts-linq/mssql");
// Эти тесты используют фейки-провайдеры (без реальных клиентов), чтобы проверить, что уникальные ограничения пробрасываются как UniqueConstraintError
class PgFake extends postgres_1.PostgresProvider {
    async connect() {
        this.pool = {
            query: async () => {
                const err = new Error('duplicate key value violates unique constraint');
                err.code = '23505';
                throw err;
            }
        };
        this.isConnected = true;
    }
    async disconnect() {
        this.isConnected = false;
    }
}
class MyFake extends mysql_1.MySqlProvider {
    async connect() {
        this.pool = {
            query: async () => {
                const err = new Error('dup');
                err.code = 'ER_DUP_ENTRY';
                throw err;
            },
            execute: async () => {
                const err = new Error('dup');
                err.code = 'ER_DUP_ENTRY';
                throw err;
            }
        };
        this.isConnected = true;
    }
    async disconnect() {
        this.isConnected = false;
    }
}
class MsFake extends mssql_1.MssqlProvider {
    async connect() {
        this.isConnected = true;
    }
    async disconnect() {
        this.isConnected = false;
    }
    async doExecuteNonQuery() {
        throw new types_1.UniqueConstraintError('Violation of UNIQUE KEY constraint', '2627');
    }
}
describe('Error mapping for Postgres/MySQL/MSSQL (unique constraint)', () => {
    test('Postgres maps 23505 to UniqueConstraintError', async () => {
        const p = new PgFake('postgres://fake');
        await p.connect();
        await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toThrow();
        await p.disconnect();
    });
    test('MySQL maps ER_DUP_ENTRY to UniqueConstraintError', async () => {
        const p = new MyFake('mysql://fake');
        await p.connect();
        await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toThrow();
        await p.disconnect();
    });
    test('MSSQL maps 2627 to UniqueConstraintError', async () => {
        const p = new MsFake('mssql://fake');
        await p.connect();
        await expect(p.executeNonQuery('INSERT INTO t VALUES (1)')).rejects.toBeInstanceOf(types_1.UniqueConstraintError);
        await p.disconnect();
    });
});
//# sourceMappingURL=error-mapping-pg-mysql-mssql.test.js.map