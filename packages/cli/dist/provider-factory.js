"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProviderFromEnv = createProviderFromEnv;
const provider_sqlite_1 = require("@ts-linq/provider-sqlite");
const provider_pg_1 = require("@ts-linq/provider-pg");
const provider_mysql_1 = require("@ts-linq/provider-mysql");
const provider_mssql_1 = require("@ts-linq/provider-mssql");
function createProviderFromEnv() {
    const kind = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
    if (isPg(kind))
        return createPg();
    if (kind === 'mysql')
        return createMy();
    if (isMs(kind))
        return createMs();
    return createSqlite();
}
function isPg(kind) {
    return kind === 'postgresql' || kind === 'postgres' || kind === 'pg';
}
function isMs(kind) {
    return kind === 'mssql' || kind === 'sqlserver';
}
function createPg() {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
    if (!url)
        throw new Error('POSTGRES_URL/DATABASE_URL is required for DB_PROVIDER=postgresql');
    return new provider_pg_1.PostgresProvider(url);
}
function createMy() {
    const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
    if (!url)
        throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
    return new provider_mysql_1.MySqlProvider(url);
}
function createMs() {
    const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
    if (!url)
        throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
    return new provider_mssql_1.MssqlProvider(url);
}
function createSqlite() {
    const conn = process.env.SQLITE_URL || ':memory:';
    return new provider_sqlite_1.SQLiteProvider(conn);
}
//# sourceMappingURL=provider-factory.js.map