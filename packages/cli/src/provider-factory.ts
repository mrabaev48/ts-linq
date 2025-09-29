import type { DatabaseProvider } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/sqlite';
import { PostgresProvider } from '@ts-linq/postgres';
import { MySqlProvider } from '@ts-linq/mysql';
import { MssqlProvider } from '@ts-linq/mssql';

export function createProviderFromEnv(): DatabaseProvider {
  const kind = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
  if (isPg(kind)) return createPg();
  if (kind === 'mysql') return createMy();
  if (isMs(kind)) return createMs();
  return createSqlite();
}

function isPg(kind: string): boolean {
  return kind === 'postgresql' || kind === 'postgres' || kind === 'pg';
}

function isMs(kind: string): boolean {
  return kind === 'mssql' || kind === 'sqlserver';
}

function createPg(): DatabaseProvider {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('POSTGRES_URL/DATABASE_URL is required for DB_PROVIDER=postgresql');
  return new PostgresProvider(url) as unknown as DatabaseProvider;
}

function createMy(): DatabaseProvider {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
  return new MySqlProvider(url) as unknown as DatabaseProvider;
}

function createMs(): DatabaseProvider {
  const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
  return new MssqlProvider(url) as unknown as DatabaseProvider;
}

function createSqlite(): DatabaseProvider {
  const conn = process.env.SQLITE_URL || ':memory:';
  return new SQLiteProvider(conn) as unknown as DatabaseProvider;
}
