import type { DatabaseProvider } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';
import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';

export function createProviderFromEnv(): DatabaseProvider {
  const kind = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
  if (kind === 'postgresql' || kind === 'postgres' || kind === 'pg') {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
    if (!url) throw new Error('POSTGRES_URL/DATABASE_URL is required for DB_PROVIDER=postgresql');
    return new PostgresProvider(url) as unknown as DatabaseProvider;
  }
  if (kind === 'mysql') {
    const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
    if (!url) throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
    return new MySqlProvider(url) as unknown as DatabaseProvider;
  }
  if (kind === 'mssql' || kind === 'sqlserver') {
    const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
    if (!url) throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
    return new MssqlProvider(url) as unknown as DatabaseProvider;
  }
  const conn = process.env.SQLITE_URL || ':memory:';
  return new SQLiteProvider(conn) as unknown as DatabaseProvider;
}
