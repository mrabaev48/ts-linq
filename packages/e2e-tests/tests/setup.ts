import { SQLiteProvider } from '@ts-linq/provider-sqlite';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import type { DatabaseProvider } from '@ts-linq/core';

export type ProviderName = 'sqlite' | 'postgres' | 'mysql' | 'mssql';

export interface TestHarness {
  provider: DatabaseProvider;
  cleanup: () => Promise<void>;
}

export async function setupTestDatabase(providerName: ProviderName): Promise<{ harness: TestHarness; provider: DatabaseProvider }> {
  let provider: DatabaseProvider;
  let cleanup: () => Promise<void>;

  switch (providerName) {
    case 'sqlite': {
      const sqliteProvider = new SQLiteProvider({ file: ':memory:' });
      await sqliteProvider.connect();
      provider = sqliteProvider;
      cleanup = async () => {
        await sqliteProvider.disconnect();
      };
      break;
    }
    case 'postgres': {
      const pgProvider = new PostgresProvider({
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'test',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres'
      });
      await pgProvider.connect();
      provider = pgProvider;
      cleanup = async () => {
        await pgProvider.disconnect();
      };
      break;
    }
    case 'mysql':
    case 'mssql':
      throw new Error(`Provider ${providerName} not configured for E2E tests yet`);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }

  return {
    harness: { provider, cleanup },
    provider
  };
}

export async function teardownTestDatabase(harness: TestHarness): Promise<void> {
  if (harness?.cleanup) {
    await harness.cleanup();
  }
}
