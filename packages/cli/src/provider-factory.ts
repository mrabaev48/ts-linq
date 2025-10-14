import type {
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  DatabaseProvider,
  CircuitBreakerOptions,
  FallbackPolicy
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
  // Конструкторы провайдеров поддерживают pool/health в конце аргументов
  const provider =
    (new PostgresProvider(
      url,
      undefined,
      undefined,
      undefined,
      undefined,
      pool,
      health
    ) as unknown as DatabaseProvider);
  if (circuit) provider.configureCircuit(circuit);
  return provider;
}

function createMy(): DatabaseProvider {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql');
  const { pool, health, circuit } = readPoolHealthCircuitFromEnv();
  const provider =
    (new MySqlProvider(
      url,
      undefined,
      undefined,
      undefined,
      undefined,
      pool,
      health
    ) as unknown as DatabaseProvider);
  if (circuit) provider.configureCircuit(circuit);
  return provider;
}

function createMs(): DatabaseProvider {
  const url = process.env.MSSQL_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('MSSQL_URL/DATABASE_URL is required for DB_PROVIDER=mssql');
  const { pool, health, circuit } = readPoolHealthCircuitFromEnv();
  const provider =
    (new MssqlProvider(
      url,
      undefined,
      undefined,
      undefined,
      undefined,
      pool,
      health
    ) as unknown as DatabaseProvider);
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

/**
 * Read Graceful Degradation fallback policy from environment variables.
 * Consumers can pass the returned policy into DbContext PerformanceOptions.
 */
export function readFallbackPolicyFromEnv(): FallbackPolicy | undefined {
  const policy: FallbackPolicy = {} as FallbackPolicy;
  if (process.env.DB_FALLBACK_ENABLED) policy.enabled = process.env.DB_FALLBACK_ENABLED === 'true';
  if (process.env.DB_FALLBACK_ALLOW_OPS)
    policy.allowOps = process.env.DB_FALLBACK_ALLOW_OPS.split(',').map((s) =>
      s.trim()
    ) as unknown as FallbackPolicy['allowOps'];
  if (process.env.DB_FALLBACK_SOURCES)
    policy.sources = process.env.DB_FALLBACK_SOURCES.split(',').map((s) => s.trim());
  // Throttle
  const throttle: NonNullable<FallbackPolicy['throttle']> = {};
  if (process.env.DB_FALLBACK_THROTTLE_MIN_MS)
    throttle.minIntervalMs = Number(process.env.DB_FALLBACK_THROTTLE_MIN_MS);
  if (process.env.DB_FALLBACK_THROTTLE_MAX_PER_MIN)
    throttle.maxPerMinute = Number(process.env.DB_FALLBACK_THROTTLE_MAX_PER_MIN);
  if (process.env.DB_FALLBACK_THROTTLE_JITTER)
    throttle.jitterRatio = Number(process.env.DB_FALLBACK_THROTTLE_JITTER);
  if (!isEmpty(throttle)) policy.throttle = throttle;
  // Hedged
  const hedged: NonNullable<FallbackPolicy['hedged']> = {};
  if (process.env.DB_FALLBACK_HEDGED_ENABLED)
    hedged.enabled = process.env.DB_FALLBACK_HEDGED_ENABLED === 'true';
  if (process.env.DB_FALLBACK_HEDGED_DELAY_MS)
    hedged.delayMs = Number(process.env.DB_FALLBACK_HEDGED_DELAY_MS);
  if (process.env.DB_FALLBACK_HEDGED_SOURCES)
    hedged.sources = process.env.DB_FALLBACK_HEDGED_SOURCES.split(',').map((s) => s.trim());
  if (!isEmpty(hedged)) policy.hedged = hedged;
  // Includes
  if (process.env.DB_FALLBACK_INCLUDES)
    policy.allowIncludesOnFallback = process.env.DB_FALLBACK_INCLUDES as 'none' | 'attempt';
  return isEmpty(policy) ? undefined : policy;
}

function isEmpty(obj: object): boolean {
  return Object.keys(obj as Record<string, unknown>).length === 0;
}
