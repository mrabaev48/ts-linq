import type {
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  DatabaseProvider
} from '@ts-linq/core';
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
  const { pool, health } = readPoolAndHealthFromEnv();
  return new PostgresProvider(
    url,
    undefined,
    undefined,
    undefined,
    undefined,
    pool,
    health
  ) as unknown as DatabaseProvider;
}

function createMy(): DatabaseProvider {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
  const { pool, health } = readPoolAndHealthFromEnv();
  return new MySqlProvider(
    url,
    undefined,
    undefined,
    undefined,
    undefined,
    pool,
    health
  ) as unknown as DatabaseProvider;
}

function createMs(): DatabaseProvider {
  const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
  const { pool, health } = readPoolAndHealthFromEnv();
  return new MssqlProvider(
    url,
    undefined,
    undefined,
    undefined,
    undefined,
    pool,
    health
  ) as unknown as DatabaseProvider;
}

function createSqlite(): DatabaseProvider {
  const conn = process.env.SQLITE_URL || ':memory:';
  return new SQLiteProvider(conn) as unknown as DatabaseProvider;
}

function readPoolAndHealthFromEnv(): {
  pool?: ConnectionPoolOptions;
  health?: ConnectionHealthCheckOptions;
} {
  const pool: ConnectionPoolOptions = {};
  const health: ConnectionHealthCheckOptions = {};
  if (process.env.DB_POOL_MIN) pool.min = Number(process.env.DB_POOL_MIN);
  if (process.env.DB_POOL_MAX) pool.max = Number(process.env.DB_POOL_MAX);
  if (process.env.DB_POOL_IDLE_MS) pool.idleTimeoutMs = Number(process.env.DB_POOL_IDLE_MS);
  if (process.env.DB_POOL_ACQUIRE_MS)
    pool.acquireTimeoutMs = Number(process.env.DB_POOL_ACQUIRE_MS);
  if (process.env.DB_CONN_TIMEOUT_MS)
    pool.connectionTimeoutMs = Number(process.env.DB_CONN_TIMEOUT_MS);
  if (process.env.DB_HEALTH_ENABLED) health.enabled = process.env.DB_HEALTH_ENABLED === 'true';
  if (process.env.DB_HEALTH_INTERVAL_MS)
    health.intervalMs = Number(process.env.DB_HEALTH_INTERVAL_MS);
  if (process.env.DB_HEALTH_TIMEOUT_MS) health.timeoutMs = Number(process.env.DB_HEALTH_TIMEOUT_MS);
  if (process.env.DB_HEALTH_TEST_QUERY) health.testQuery = process.env.DB_HEALTH_TEST_QUERY;
  if (process.env.DB_HEALTH_MIN_INTERVAL_MS)
    health.minIntervalMs = Number(process.env.DB_HEALTH_MIN_INTERVAL_MS);
  if (process.env.DB_HEALTH_MAX_INTERVAL_MS)
    health.maxIntervalMs = Number(process.env.DB_HEALTH_MAX_INTERVAL_MS);
  if (process.env.DB_HEALTH_DEGRADE_AFTER)
    health.degradeAfterFailures = Number(process.env.DB_HEALTH_DEGRADE_AFTER);
  if (process.env.DB_HEALTH_UNHEALTHY_AFTER)
    health.unhealthyAfterFailures = Number(process.env.DB_HEALTH_UNHEALTHY_AFTER);
  return { pool: isEmpty(pool) ? undefined : pool, health: isEmpty(health) ? undefined : health };
}

function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}
