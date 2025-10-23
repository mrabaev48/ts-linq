import { createProviderFromEnv } from '../src/provider-factory';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import { MySqlProvider } from '@ts-linq/provider-mysql';
import { SQLiteProvider } from '@ts-linq/provider-sqlite';

vi.mock('@ts-linq/provider-postgres');
vi.mock('@ts-linq/provider-mysql');
vi.mock('@ts-linq/provider-sqlite');

describe('Provider Factory - Environment Variable Mapping', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('PostgreSQL Provider', () => {
    test('creates provider with pool and health options from environment', () => {
      process.env.DB_PROVIDER = 'postgresql';
      process.env.POSTGRES_URL = 'postgres://user:pass@localhost:5432/testdb';
      process.env.DB_POOL_MIN = '2';
      process.env.DB_POOL_MAX = '20';
      process.env.DB_POOL_IDLE_MS = '30000';
      process.env.DB_POOL_ACQUIRE_MS = '5000';
      process.env.DB_CONN_TIMEOUT_MS = '10000';
      process.env.DB_HEALTH_ENABLED = 'true';
      process.env.DB_HEALTH_INTERVAL_MS = '60000';
      process.env.DB_HEALTH_TIMEOUT_MS = '5000';
      process.env.DB_HEALTH_TEST_QUERY = 'SELECT 42';
      process.env.DB_HEALTH_MIN_INTERVAL_MS = '1000';
      process.env.DB_HEALTH_MAX_INTERVAL_MS = '10000';
      process.env.DB_HEALTH_DEGRADE_AFTER = '3';
      process.env.DB_HEALTH_UNHEALTHY_AFTER = '5';

      createProviderFromEnv();

      expect(PostgresProvider).toHaveBeenCalledWith(
        'postgres://user:pass@localhost:5432/testdb',
        undefined,
        undefined,
        undefined,
        undefined,
        {
          min: 2,
          max: 20,
          idleTimeoutMs: 30000,
          acquireTimeoutMs: 5000,
          connectionTimeoutMs: 10000
        },
        {
          enabled: true,
          intervalMs: 60000,
          timeoutMs: 5000,
          testQuery: 'SELECT 42',
          minIntervalMs: 1000,
          maxIntervalMs: 10000,
          degradeAfterFailures: 3,
          unhealthyAfterFailures: 5
        }
      );
    });

    test('creates provider without optional pool/health when env vars not set', () => {
      process.env.DB_PROVIDER = 'pg';
      process.env.POSTGRES_URL = 'postgres://localhost/db';

      createProviderFromEnv();

      expect(PostgresProvider).toHaveBeenCalledWith(
        'postgres://localhost/db',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    test('uses DATABASE_URL fallback when POSTGRES_URL not set', () => {
      process.env.DB_PROVIDER = 'postgres';
      process.env.DATABASE_URL = 'postgres://fallback/db';

      createProviderFromEnv();

      expect(PostgresProvider).toHaveBeenCalledWith(
        'postgres://fallback/db',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    test('throws error when neither POSTGRES_URL nor DATABASE_URL provided', () => {
      process.env.DB_PROVIDER = 'postgresql';
      delete process.env.POSTGRES_URL;
      delete process.env.DATABASE_URL;

      expect(() => createProviderFromEnv()).toThrow(
        'POSTGRES_URL/DATABASE_URL is required for DB_PROVIDER=postgresql'
      );
    });
  });

  describe('MySQL Provider', () => {
    test('creates MySQL provider with pool and health options', () => {
      process.env.DB_PROVIDER = 'mysql';
      process.env.MYSQL_URL = 'mysql://user:pass@localhost:3306/testdb';
      process.env.DB_POOL_MIN = '1';
      process.env.DB_POOL_MAX = '10';
      process.env.DB_HEALTH_ENABLED = 'true';
      process.env.DB_HEALTH_INTERVAL_MS = '30000';

      createProviderFromEnv();

      expect(MySqlProvider).toHaveBeenCalledWith(
        'mysql://user:pass@localhost:3306/testdb',
        undefined,
        undefined,
        undefined,
        undefined,
        {
          min: 1,
          max: 10
        },
        {
          enabled: true,
          intervalMs: 30000
        }
      );
    });

    test('throws error when MYSQL_URL not provided', () => {
      process.env.DB_PROVIDER = 'mysql';
      delete process.env.MYSQL_URL;
      delete process.env.DATABASE_URL;

      expect(() => createProviderFromEnv()).toThrow(
        'MYSQL_URL/DATABASE_URL is required for DB_PROVIDER=mysql'
      );
    });
  });

  describe('SQLite Provider', () => {
    test('creates SQLite provider with in-memory database by default', () => {
      process.env.DB_PROVIDER = 'sqlite';

      createProviderFromEnv();

      expect(SQLiteProvider).toHaveBeenCalledWith(':memory:');
    });

    test('creates SQLite provider with custom database path', () => {
      process.env.DB_PROVIDER = 'sqlite';
      process.env.SQLITE_URL = './data/test.db';

      createProviderFromEnv();

      expect(SQLiteProvider).toHaveBeenCalledWith('./data/test.db');
    });

    test('defaults to SQLite when DB_PROVIDER not set', () => {
      delete process.env.DB_PROVIDER;

      createProviderFromEnv();

      expect(SQLiteProvider).toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Configuration', () => {
    test('configures circuit breaker when env vars provided', () => {
      const mockProvider = {
        configureCircuit: vi.fn()
      };
      (PostgresProvider as jest.Mock).mockReturnValue(mockProvider);

      process.env.DB_PROVIDER = 'postgresql';
      process.env.POSTGRES_URL = 'postgres://localhost/db';
      process.env.DB_CB_ENABLED = 'true';
      process.env.DB_CB_THRESHOLD = '5';
      process.env.DB_CB_OPEN_MS = '60000';

      createProviderFromEnv();

      expect(mockProvider.configureCircuit).toHaveBeenCalledWith({
        enabled: true,
        failureThreshold: 5,
        openDurationMs: 60000
      });
    });
  });

  describe('Real-world scenarios', () => {
    test('production-like PostgreSQL configuration', () => {
      process.env.DB_PROVIDER = 'postgresql';
      process.env.POSTGRES_URL = 'postgres://prod_user:secret@prod-db.example.com:5432/appdb';
      process.env.DB_POOL_MIN = '5';
      process.env.DB_POOL_MAX = '50';
      process.env.DB_POOL_IDLE_MS = '60000';
      process.env.DB_POOL_ACQUIRE_MS = '10000';
      process.env.DB_HEALTH_ENABLED = 'true';
      process.env.DB_HEALTH_INTERVAL_MS = '30000';
      process.env.DB_HEALTH_TIMEOUT_MS = '3000';
      process.env.DB_CB_ENABLED = 'true';
      process.env.DB_CB_THRESHOLD = '3';
      process.env.DB_CB_OPEN_MS = '30000';

      const mockProvider = {
        configureCircuit: vi.fn()
      };
      (PostgresProvider as jest.Mock).mockReturnValue(mockProvider);

      const provider = createProviderFromEnv();

      expect(PostgresProvider).toHaveBeenCalledWith(
        expect.stringContaining('prod-db.example.com'),
        undefined,
        undefined,
        undefined,
        undefined,
        expect.objectContaining({
          min: 5,
          max: 50,
          idleTimeoutMs: 60000,
          acquireTimeoutMs: 10000
        }),
        expect.objectContaining({
          enabled: true,
          intervalMs: 30000,
          timeoutMs: 3000
        })
      );
      expect(mockProvider.configureCircuit).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          failureThreshold: 3,
          openDurationMs: 30000
        })
      );
      expect(provider).toBe(mockProvider);
    });

    test('development-like SQLite configuration', () => {
      process.env.DB_PROVIDER = 'sqlite';
      process.env.SQLITE_URL = ':memory:';

      const provider = createProviderFromEnv();

      expect(SQLiteProvider).toHaveBeenCalledWith(':memory:');
      expect(provider).toBeDefined();
    });
  });
});
