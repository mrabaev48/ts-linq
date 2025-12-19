import { describe, it, expect, jest } from '@jest/globals';
import { Queryable } from '../src/Queryable';
import { MemoryFallback } from '../src/fallbacks/MemoryFallback';
import type { QueryFallback, SqlDialect, SqlParameter, QueryOptions } from '@ts-linq/types';
import { DatabaseProvider } from '@ts-linq/core';

class TestEntity {
  id!: number;
  name!: string;
}

class MockDialect implements SqlDialect {
  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
  buildSelect<T>(_entityClass: new () => T, _options: QueryOptions): { query: string; parameters: readonly SqlParameter[] } {
    return { query: 'SELECT * FROM TestEntity', parameters: [] };
  }
}

function createMockProvider(overrides: Record<string, unknown> = {}): DatabaseProvider {
  const dialect = new MockDialect();
  return {
    providerLabel: 'mock',
    isConnected: true,
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    executeQuery: jest.fn().mockResolvedValue([]),
    executeNonQuery: jest.fn().mockResolvedValue(0),
    getDialect: () => dialect,
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as DatabaseProvider;
}

function createFailingProvider(): DatabaseProvider {
  return createMockProvider({
    executeQuery: jest.fn().mockRejectedValue(new Error('connection timeout'))
  });
}

function createFallback<T>(
  label: string,
  data: T[],
  options?: { delayMs?: number; countValue?: number }
): QueryFallback<T> {
  return {
    label,
    async fetch() {
      if (options?.delayMs) await new Promise(r => setTimeout(r, options.delayMs));
      return data;
    },
    fetchCount: options?.countValue !== undefined
      ? async () => options.countValue!
      : async () => data.length,
    canHandle: () => true,
    execute: async () => data
  } as QueryFallback<T>;
}

describe('Graceful Degradation - fallbackTo', () => {
  it('uses memory fallback when provider errors with connection issue', async () => {
    const provider = createFailingProvider();
    const memory: TestEntity[] = [
      { id: 1, name: 'U1' },
      { id: 2, name: 'U2' }
    ];

    const q = new Queryable(TestEntity, provider).fallbackTo(
      new MemoryFallback<TestEntity>(() => memory)
    );
    const res = await q.toArray();
    expect(res.map((u) => u.name)).toEqual(['U1', 'U2']);
  });
});

describe('Graceful Degradation Policy', () => {
  it('does not fallback for select when policy forbids select', async () => {
    const provider = createFailingProvider();
    const memory = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' }
    ];

    const q = new Queryable(TestEntity, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ allowOps: ['count'] });

    await expect(q.toArray()).rejects.toThrow(/connection/i);
  });

  it('falls back for count when only count is allowed', async () => {
    const provider = createFailingProvider();
    const memory = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' }
    ];

    const q = new Queryable(TestEntity, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ allowOps: ['count'] });

    const n = await q.count();
    expect(n).toBe(3);
  });

  it('throws when no fallback sources configured', async () => {
    const provider = createFailingProvider();
    const q = new Queryable(TestEntity, provider).withFallbackPolicy({ allowOps: ['select', 'count'] });
    await expect(q.toArray()).rejects.toThrow(/connection/i);
  });
});

describe('Graceful Degradation Throttle', () => {
  it('respects minIntervalMs between fallbacks', async () => {
    const provider = createFailingProvider();
    const memory = [{ id: 1, name: 'A' }];
    const base = new Queryable(TestEntity, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ throttle: { minIntervalMs: 10 }, allowOps: ['select'] });

    const ok1 = await base.toArray();
    expect(ok1.length).toBe(1);

    const p1 = base.toArray();
    const p2 = base.toArray();
    const results = await Promise.allSettled([p1, p2]);
    expect(results.some((r) => r.status === 'rejected')).toBe(true);
  });

  it('resets window counter for maxPerMinute after limit reached', async () => {
    const provider = createFailingProvider();
    const memory = [{ id: 1, name: 'A' }];
    const base = new Queryable(TestEntity, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ throttle: { maxPerMinute: 1 }, allowOps: ['select'] });

    const ok = await base.toArray();
    expect(ok.length).toBe(1);

    await expect(base.toArray()).rejects.toThrow(/connection/i);
  });
});

describe('Graceful Degradation - hedged select', () => {
  it('fallback wins when primary is slow', async () => {
    const slowProvider = createMockProvider({
      executeQuery: jest.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return [{ id: 1, name: 'P1' }];
      })
    });

    const fallbackRows: TestEntity[] = [
      { id: 100, name: 'F1' },
      { id: 101, name: 'F2' }
    ];

    const q = new Queryable(TestEntity, slowProvider)
      .fallbackTo(createFallback('replica', fallbackRows))
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 1, sources: ['replica'] as unknown as [] } });

    const rows = await q.toArray();
    expect(rows.map((r) => r.name)).toEqual(['F1', 'F2']);
  });

  it('primary wins when primary is fast enough', async () => {
    const fastProvider = createMockProvider({
      executeQuery: jest.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 1));
        return [{ id: 1, name: 'P1' }, { id: 2, name: 'P2' }];
      })
    });

    const q = new Queryable(TestEntity, fastProvider)
      .fallbackTo(createFallback('replica', [], { delayMs: 50 }))
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 10, sources: ['replica'] as unknown as [] } });

    const rows = await q.toArray();
    expect(rows.map((r) => r.name)).toEqual(['P1', 'P2']);
  });
});

describe('Graceful Degradation - hedged count', () => {
  it('fallback server-count wins the race when primary count is slow', async () => {
    const slowProvider = createMockProvider({
      executeQuery: jest.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return [{ count: 5 }];
      })
    });

    const fastCount = 1234;

    const q = new Queryable(TestEntity, slowProvider)
      .fallbackTo(createFallback('replica', [], { countValue: fastCount }))
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 1 }, allowOps: ['count'] });

    const n = await q.count();
    expect(n).toBe(fastCount);
  });
});

describe('ReplicaFallback.fetchCount', () => {
  it('uses server-side fetchCount when available', async () => {
    const provider = createFailingProvider();

    const q = new Queryable(TestEntity, provider)
      .fallbackTo(createFallback('replica', [], { countValue: 42 }))
      .withFallbackPolicy({ allowOps: ['count'] });
    const n = await q.count();
    expect(n).toBe(42);
  });

  it('falls back to SELECT length when fetchCount not provided', async () => {
    const provider = createFailingProvider();
    const rows: TestEntity[] = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' }
    ];

    const fb: QueryFallback<TestEntity> = {
      label: 'replica',
      async fetch() { return rows; },
      canHandle: () => true,
      execute: async () => rows
    } as QueryFallback<TestEntity>;

    const q = new Queryable(TestEntity, provider).fallbackTo(fb).withFallbackPolicy({ allowOps: ['count'] });
    const n = await q.count();
    expect(n).toBe(2);
  });
});

describe('Hedged sources filtering', () => {
  it('uses only sources listed in hedged.sources', async () => {
    const slowProvider = createMockProvider({
      executeQuery: jest.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return [];
      })
    });

    const q = new Queryable(TestEntity, slowProvider)
      .fallbackTo(createFallback('replica', [{ id: 1, name: 'R' }]))
      .fallbackTo(createFallback('memory', [{ id: 2, name: 'M' }], { delayMs: 100 }))
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 1, sources: ['replica'] as unknown as [] } });

    const res = await q.toArray();
    expect(res.map((x) => x.name)).toEqual(['R']);
  });
});
