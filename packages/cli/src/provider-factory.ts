import type {
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  DatabaseProvider,
  CircuitBreakerOptions
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
  const { pool, health, circuit } = readPoolHealthCircuitFromEnv();
  const provider = new PostgresProvider(url) as unknown as DatabaseProvider;
  if (pool || health) provider.configureConnection({ pool, health });
  if (circuit) provider.configureCircuit(circuit);
  return provider;
}

function createMy(): DatabaseProvider {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
  const { pool, health, circuit } = readPoolHealthCircuitFromEnv();
  const provider = new MySqlProvider(url) as unknown as DatabaseProvider;
  if (pool || health) provider.configureConnection({ pool, health });
  if (circuit) provider.configureCircuit(circuit);
  return provider;
}

function createMs(): DatabaseProvider {
  const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
  const { pool, health, circuit } = readPoolHealthCircuitFromEnv();
  const provider = new MssqlProvider(url) as unknown as DatabaseProvider;
  if (pool || health) provider.configureConnection({ pool, health });
  if (circuit) provider.configureCircuit(circuit);
  return provider;
}

function createSqlite(): DatabaseProvider {
  const conn = process.env.SQLITE_URL || ':memory:';
  const provider = new SQLiteProvider(conn) as unknown as DatabaseProvider;
  const { circuit } = readPoolHealthCircuitFromEnv();
  if (circuit) provider.configureCircuit(circuit);
  return provider;
}

function readPoolHealthCircuitFromEnv(): {
  pool?: ConnectionPoolOptions;
  health?: ConnectionHealthCheckOptions;
  circuit?: CircuitBreakerOptions;
} {
  const pool = readPoolFromEnv();
  const health = readHealthFromEnv();
  const circuit = readCircuitFromEnv();
  return { pool, health, circuit };
}

function readPoolFromEnv(): ConnectionPoolOptions | undefined {
  const pool: ConnectionPoolOptions = {};
  if (process.env.DB_POOL_MIN) pool.min = Number(process.env.DB_POOL_MIN);
  if (process.env.DB_POOL_MAX) pool.max = Number(process.env.DB_POOL_MAX);
  if (process.env.DB_POOL_IDLE_MS) pool.idleTimeoutMs = Number(process.env.DB_POOL_IDLE_MS);
  if (process.env.DB_POOL_ACQUIRE_MS)
    pool.acquireTimeoutMs = Number(process.env.DB_POOL_ACQUIRE_MS);
  if (process.env.DB_CONN_TIMEOUT_MS)
    pool.connectionTimeoutMs = Number(process.env.DB_CONN_TIMEOUT_MS);
  return isEmpty(pool) ? undefined : pool;
}

function readHealthFromEnv(): ConnectionHealthCheckOptions | undefined {
  const health: ConnectionHealthCheckOptions = {};
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
  return isEmpty(health) ? undefined : health;
}

function readCircuitFromEnv(): CircuitBreakerOptions | undefined {
  const circuit: CircuitBreakerOptions = {};
  if (process.env.DB_CB_ENABLED) circuit.enabled = process.env.DB_CB_ENABLED === 'true';
  if (process.env.DB_CB_THRESHOLD) circuit.failureThreshold = Number(process.env.DB_CB_THRESHOLD);
  if (process.env.DB_CB_OPEN_MS) circuit.openDurationMs = Number(process.env.DB_CB_OPEN_MS);
  if (process.env.DB_CB_MAX_OPEN_MS)
    circuit.maxOpenDurationMs = Number(process.env.DB_CB_MAX_OPEN_MS);
  if (process.env.DB_CB_HALFOPEN_MAX_CALLS)
    circuit.halfOpenMaxCalls = Number(process.env.DB_CB_HALFOPEN_MAX_CALLS);
  if (process.env.DB_CB_COUNT_TRANSIENT_ONLY)
    circuit.countTransientOnly = process.env.DB_CB_COUNT_TRANSIENT_ONLY === 'true';
  return isEmpty(circuit) ? undefined : circuit;
}

function isEmpty(obj: object): boolean {
  return Object.keys(obj as Record<string, unknown>).length === 0;
}
