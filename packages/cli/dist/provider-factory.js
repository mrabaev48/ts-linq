"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProviderFromEnv = createProviderFromEnv;
const sqlite_1 = require("@ts-linq/sqlite");
const postgres_1 = require("@ts-linq/postgres");
const mysql_1 = require("@ts-linq/mysql");
const mssql_1 = require("@ts-linq/mssql");
function createProviderFromEnv() {
    const kind = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
    if (kind === 'postgresql' || kind === 'postgres' || kind === 'pg') {
        const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
        if (!url)
            throw new Error('POSTGRES_URL/DATABASE_URL is required for DB_PROVIDER=postgresql');
        return new postgres_1.PostgresProvider(url);
    }
    if (kind === 'mysql') {
        const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
        if (!url)
            throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
        return new mysql_1.MySqlProvider(url);
    }
    if (kind === 'mssql' || kind === 'sqlserver') {
        const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
        if (!url)
            throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
        return new mssql_1.MssqlProvider(url);
    }
    const conn = process.env.SQLITE_URL || ':memory:';
    return new sqlite_1.SQLiteProvider(conn);
}
//# sourceMappingURL=provider-factory.js.map