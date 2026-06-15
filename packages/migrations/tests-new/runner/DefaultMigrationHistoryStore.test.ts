import { describe, expect, it, jest } from '@jest/globals';
import type { DatabaseProvider } from '@ts-linq/core';

import { DefaultMigrationHistoryStore } from '../../src/runner/DefaultMigrationHistoryStore';

interface FakeOptions {
  /** Whether the bookkeeping table exists (drives the information_schema probe). */
  exists?: boolean;
  /** Rows returned by the bookkeeping SELECT. */
  rows?: Array<{ version: string; name: string; applied_at: string }>;
  /** When set, the bookkeeping SELECT (not the probe) rejects with this error. */
  selectError?: Error;
}

function createFakeProvider(opts: FakeOptions = {}): DatabaseProvider & {
  nonQueries: Array<{ sql: string; params?: unknown[] }>;
} {
  const { exists = true, rows = [], selectError } = opts;
  const nonQueries: Array<{ sql: string; params?: unknown[] }> = [];

  return {
    nonQueries,
    providerLabel: 'postgresql',
    executeQuery: jest.fn(async <T = unknown>(sql: string): Promise<T[]> => {
      if (sql.includes('information_schema.tables')) {
        return [{ cnt: exists ? 1 : 0 }] as T[];
      }
      if (sql.includes('SELECT version, name, applied_at FROM __migrations')) {
        if (selectError) {
          throw selectError;
        }
        return rows as T[];
      }
      return [];
    }) as DatabaseProvider['executeQuery'],
    executeNonQuery: jest.fn(async (sql: string, params?: unknown[]): Promise<number> => {
      nonQueries.push({ sql, params });
      return 1;
    }) as DatabaseProvider['executeNonQuery']
  } as unknown as DatabaseProvider & { nonQueries: Array<{ sql: string; params?: unknown[] }> };
}

describe('DefaultMigrationHistoryStore', () => {
  describe('list()', () => {
    it('returns [] when the table is genuinely absent', async () => {
      const provider = createFakeProvider({ exists: false });
      const store = new DefaultMigrationHistoryStore(provider);

      await expect(store.list()).resolves.toEqual([]);
    });

    it('returns applied records ordered by version when the table exists', async () => {
      const provider = createFakeProvider({
        exists: true,
        rows: [{ version: '001', name: 'CreateUsers', applied_at: '2025-01-01T00:00:00.000Z' }]
      });
      const store = new DefaultMigrationHistoryStore(provider);

      const applied = await store.list();

      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe('001');
      expect(applied[0].appliedAt).toBeInstanceOf(Date);
    });

    it('propagates a query error against an existing table (no silent empty result)', async () => {
      const provider = createFakeProvider({
        exists: true,
        selectError: new Error('permission denied')
      });
      const store = new DefaultMigrationHistoryStore(provider);

      await expect(store.list()).rejects.toThrow('permission denied');
    });
  });

  describe('ensureExists()', () => {
    it('issues the dialect CREATE TABLE DDL', async () => {
      const provider = createFakeProvider();
      const store = new DefaultMigrationHistoryStore(provider);

      await store.ensureExists();

      expect(provider.executeNonQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS __migrations')
      );
    });
  });

  describe('record() / remove()', () => {
    it('records via a parameterized INSERT', async () => {
      const provider = createFakeProvider();
      const store = new DefaultMigrationHistoryStore(provider);

      await store.record('001', 'CreateUsers', new Date('2025-01-01T00:00:00.000Z'));

      const insert = provider.nonQueries.find((q) => q.sql.includes('INSERT INTO __migrations'));
      expect(insert).toBeDefined();
      expect(insert?.sql).toContain('VALUES (?, ?, ?)');
      expect(insert?.params).toEqual(['001', 'CreateUsers', '2025-01-01T00:00:00.000Z']);
    });

    it('removes via a parameterized DELETE', async () => {
      const provider = createFakeProvider();
      const store = new DefaultMigrationHistoryStore(provider);

      await store.remove('001');

      const del = provider.nonQueries.find((q) => q.sql.includes('DELETE FROM __migrations'));
      expect(del).toBeDefined();
      expect(del?.sql).toContain('WHERE version = ?');
      expect(del?.params).toEqual(['001']);
    });
  });
});
