import { describe, expect, it } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';

import { DefaultMigrationHistoryStore } from '../../src/runner/DefaultMigrationHistoryStore';
import type {
  MigrationHistoryStore,
  MigrationRecord
} from '../../src/runner/MigrationHistoryStore';

/** In-memory fake honouring the {@link MigrationHistoryStore} contract. */
class InMemoryMigrationHistoryStore implements MigrationHistoryStore {
  private exists = false;
  private readonly records: MigrationRecord[] = [];

  public async ensureExists(): Promise<void> {
    this.exists = true;
  }

  public async list(): Promise<MigrationRecord[]> {
    if (!this.exists) {
      return [];
    }
    return [...this.records].sort((a, b) => a.version.localeCompare(b.version));
  }

  public async record(version: string, name: string, appliedAt: Date): Promise<void> {
    this.records.push({ version, name, appliedAt });
  }

  public async remove(version: string): Promise<void> {
    const index = this.records.findIndex((r) => r.version === version);
    if (index !== -1) {
      this.records.splice(index, 1);
    }
  }
}

/** Stateful fake provider that faithfully backs {@link DefaultMigrationHistoryStore}. */
function createStatefulProvider(): DatabaseProvider {
  const rows: Array<{ version: string; name: string; applied_at: string }> = [];
  let tableExists = false;

  return {
    providerLabel: 'postgresql',
    executeQuery: async <T = unknown>(sql: string): Promise<T[]> => {
      if (sql.includes('information_schema.tables')) {
        return [{ cnt: tableExists ? 1 : 0 }] as T[];
      }
      if (sql.includes('SELECT version, name, applied_at FROM __migrations')) {
        return [...rows].sort((a, b) => a.version.localeCompare(b.version)) as T[];
      }
      return [];
    },
    executeNonQuery: async (sql: string, params?: unknown[]): Promise<number> => {
      if (sql.includes('CREATE TABLE') && sql.includes('__migrations')) {
        tableExists = true;
      } else if (sql.includes('INSERT INTO __migrations')) {
        const [version, name, applied_at] = params as [string, string, string];
        rows.push({ version, name, applied_at });
      } else if (sql.includes('DELETE FROM __migrations')) {
        const [version] = params as [string];
        const index = rows.findIndex((r) => r.version === version);
        if (index !== -1) {
          rows.splice(index, 1);
        }
      }
      return 1;
    }
  } as unknown as DatabaseProvider;
}

const implementations: Array<{ name: string; create: () => MigrationHistoryStore }> = [
  {
    name: 'InMemoryMigrationHistoryStore (fake)',
    create: () => new InMemoryMigrationHistoryStore()
  },
  {
    name: 'DefaultMigrationHistoryStore (provider-backed)',
    create: () => new DefaultMigrationHistoryStore(createStatefulProvider())
  }
];

describe.each(implementations)('MigrationHistoryStore contract: $name', ({ create }) => {
  it('returns [] before the table exists', async () => {
    const store = create();
    await expect(store.list()).resolves.toEqual([]);
  });

  it('lists a recorded migration after ensureExists', async () => {
    const store = create();
    await store.ensureExists();
    await store.record('001', 'CreateUsers', new Date('2025-01-01T00:00:00.000Z'));

    const applied = await store.list();

    expect(applied).toHaveLength(1);
    expect(applied[0].version).toBe('001');
    expect(applied[0].name).toBe('CreateUsers');
    expect(applied[0].appliedAt).toBeInstanceOf(Date);
  });

  it('orders multiple records by version', async () => {
    const store = create();
    await store.ensureExists();
    await store.record('002', 'Second', new Date());
    await store.record('001', 'First', new Date());

    const applied = await store.list();

    expect(applied.map((r) => r.version)).toEqual(['001', '002']);
  });

  it('drops a record after remove', async () => {
    const store = create();
    await store.ensureExists();
    await store.record('001', 'CreateUsers', new Date());
    await store.remove('001');

    await expect(store.list()).resolves.toEqual([]);
  });
});
