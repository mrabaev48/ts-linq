import { createProviderFromEnv } from '../src/provider-factory';

describe('CLI provider factory ENV mapping', () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
  });
  afterEach(() => {
    process.env = env;
    delete (global as any).__constructed;
  });

  test('maps DB_POOL_* and DB_HEALTH_* into provider options', () => {
    process.env.DB_PROVIDER = 'postgresql';
    process.env.POSTGRES_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.DB_POOL_MIN = '2';
    process.env.DB_POOL_MAX = '20';
    process.env.DB_POOL_IDLE_MS = '30000';
    process.env.DB_POOL_ACQUIRE_MS = '5000';
    process.env.DB_CONN_TIMEOUT_MS = '10000';
    process.env.DB_HEALTH_ENABLED = 'true';
    process.env.DB_HEALTH_INTERVAL_MS = '60000';
    process.env.DB_HEALTH_TIMEOUT_MS = '5000';
    process.env.DB_HEALTH_TEST_QUERY = 'SELECT 42';
    process.env.DB_HEALTH_MIN_INTERVAL_MS = '1234';
    process.env.DB_HEALTH_MAX_INTERVAL_MS = '9876';
    process.env.DB_HEALTH_DEGRADE_AFTER = '4';
    process.env.DB_HEALTH_UNHEALTHY_AFTER = '8';

    createProviderFromEnv();

    const constructed = (global as any).__constructed as { pool: any; health: any };
    expect(constructed).toBeDefined();
    expect(constructed.pool).toMatchObject({
      min: 2,
      max: 20,
      idleTimeoutMs: 30000,
      acquireTimeoutMs: 5000,
      connectionTimeoutMs: 10000
    });
    expect(constructed.health).toMatchObject({
      enabled: true,
      intervalMs: 60000,
      timeoutMs: 5000,
      testQuery: 'SELECT 42',
      minIntervalMs: 1234,
      maxIntervalMs: 9876,
      degradeAfterFailures: 4,
      unhealthyAfterFailures: 8
    });
  });
});
