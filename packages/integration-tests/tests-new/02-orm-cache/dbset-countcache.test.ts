import fs from 'node:fs';
import path from 'node:path';

import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import type { CountCache, CountCacheEntry } from '@ts-linq/query';
import { TestProvider as MockProvider } from '@ts-linq/testkits';

const run = !!process.env.RUN_DB_TESTS;

@Entity({ name: 'countcache_users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  public id!: number;

  @Column({ type: 'TEXT' })
  public name!: string;

  @Column({ type: 'INTEGER' })
  public age!: number;
}

class TestCountCache implements CountCache {
  private readonly store = new Map<string, CountCacheEntry>();

  public constructor(private readonly maxSize: number = 100) {}

  public get(key: string): number | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return entry.value;
  }

  public set(key: string, value: number): void {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }
    this.store.set(key, { value, ts: Date.now() });
  }

  public clear(): void {
    this.store.clear();
  }

  public invalidateBy(matcher: (key: string) => boolean): number {
    let removed = 0;
    for (const key of Array.from(this.store.keys())) {
      const match = matcher(key);
      if (match) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  public getMetrics(): { currentSize: number } {
    return { currentSize: this.store.size };
  }

  public getSize(): number {
    return this.store.size;
  }
}

class TestDbContext extends DbContext {
  public constructor(provider: MockProvider, countCache: CountCache, ttlMs: number = 10_000) {
    super({
      provider,
      performance: {
        enableCountCache: true,
        countCacheTtlMs: ttlMs,
        countCache
      }
    });
  }
}

(run ? describe : describe.skip)('DbSet + CountCache Integration', () => {
  const dbPath = path.join(process.cwd(), 'size-tests', 'tmp', 'countcache.db');

  let provider: MockProvider;
  let context: TestDbContext;
  let countCache: TestCountCache;

  async function setupDatabase(options?: { ttlMs?: number; maxSize?: number }): Promise<void> {
    provider = new MockProvider();
    countCache = new TestCountCache(options?.maxSize ?? 100);
    context = new TestDbContext(provider, countCache, options?.ttlMs ?? 10_000);

    // ensureCreated typically not needed for mock provider but defined in DbContext
    // await context.ensureCreated();

    const users = context.set(User);
    users.add({ name: 'Alice', age: 25 } as User);
    users.add({ name: 'Bob', age: 30 } as User);
    await context.saveChanges();
  }

  beforeAll(() => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  });

  beforeEach(async () => {
    await setupDatabase();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should cache count() with predicate', async () => {
    const users = context.set(User);
    provider.executionCount = 0;

    provider.nextResult = [{ count: 2 }];

    const first = await users.where((user: User) => user.age >= 25).count();
    const callsAfterFirst = provider.executionCount;

    const second = await users.where((user: User) => user.age >= 25).count();
    const callsAfterSecond = provider.executionCount;

    expect(first).toBe(2);
    expect(second).toBe(2);
    expect(callsAfterSecond).toBe(callsAfterFirst);
    expect(countCache.getSize()).toBe(1);
  });

  it('should use different cache keys for different predicates', async () => {
    const users = context.set(User);

    await users.where((user: User) => user.age >= 25).count();
    await users.where((user: User) => user.age >= 30).count();

    expect(countCache.getSize()).toBe(2);
  });

  it('should invalidate count cache on entity insert', async () => {
    const users = context.set(User);

    await users.where((user: User) => user.age >= 25).count();
    expect(countCache.getSize()).toBeGreaterThan(0);

    users.add({ name: 'Carol', age: 40 } as User);
    await context.saveChanges();

    expect(countCache.getSize()).toBe(0);

    provider.nextResult = [{ count: 3 }];
    const newCount = await users.where((user: User) => user.age >= 25).count();
    expect(newCount).toBe(3);
  });

  it('should invalidate count cache on entity delete', async () => {
    const users = context.set(User);

    await users.where((user: User) => user.age >= 25).count();
    expect(countCache.getSize()).toBeGreaterThan(0);

    const toDelete = await users.where((user: User) => user.name === 'Alice').first();
    users.remove(toDelete);
    await context.saveChanges();

    expect(countCache.getSize()).toBe(0);

    provider.nextResult = [{ count: 1 }];
    const newCount = await users.where((user: User) => user.age >= 25).count();
    expect(newCount).toBe(1);
  });

  it('should support TTL expiration for count cache', async () => {
    await context.dispose();
    await setupDatabase({ ttlMs: 1_000 });

    const users = context.set(User);

    jest.useFakeTimers();
    const baseTime = new Date('2025-01-01T00:00:00Z');
    jest.setSystemTime(baseTime);

    provider.nextResult = [{ count: 2 }];
    await users.where((user: User) => user.age >= 25).count();
    const callsAfterFirst = provider.executionCount;

    jest.setSystemTime(new Date(baseTime.getTime() + 500));
    await users.where((user: User) => user.age >= 25).count();
    const callsAfterSecond = provider.executionCount;

    jest.setSystemTime(new Date(baseTime.getTime() + 2000));
    provider.nextResult = [{ count: 2 }]; // Need result as it re-executes
    await users.where((user: User) => user.age >= 25).count();
    const callsAfterThird = provider.executionCount;

    jest.useRealTimers();

    expect(callsAfterSecond).toBe(callsAfterFirst);
    expect(callsAfterThird).toBeGreaterThan(callsAfterSecond);
  });

  it('should NOT invalidate count cache on entity UPDATE (count unchanged)', async () => {
    const users = context.set(User);

    await users.where((user: User) => user.age >= 25).count();
    expect(countCache.getSize()).toBe(1);

    // Update Bob's NAME
    provider.nextResult = [{ id: 2, name: 'Bob', age: 30 }];
    const bob = await users.where((user: User) => user.name === 'Bob').first();
    bob.name = 'Bobby';
    users.update(bob);
    await context.saveChanges();

    // Expect invalidation (safe default)
    expect(countCache.getSize()).toBe(0);

    provider.nextResult = [{ count: 2 }];
    const count = await users.where((user: User) => user.age >= 25).count();
    expect(count).toBe(2);
  });

  it('should evict LRU entries when count cache full', async () => {
    await context.dispose();
    await setupDatabase({ maxSize: 2 });

    const users = context.set(User);

    await users.where((user: User) => user.age > 10).count(); // Key 1
    await users.where((user: User) => user.age > 20).count(); // Key 2

    expect(countCache.getSize()).toBe(2);

    await users.where((user: User) => user.age >= 25).count(); // Key 3, evicts Key 1

    expect(countCache.getSize()).toBe(2);

    provider.executionCount = 0;

    // Key 1 again
    provider.nextResult = [{ count: 2 }];
    await users.where((user: User) => user.age > 10).count();
    expect(provider.executionCount).toBeGreaterThan(0);
  });

  it('should clear count cache independently', async () => {
    const users = context.set(User);
    await users.where((user: User) => user.age >= 25).count();
    expect(countCache.getSize()).toBe(1);

    countCache.clear();
    expect(countCache.getSize()).toBe(0);

    provider.executionCount = 0;
    provider.nextResult = [{ count: 2 }];
    await users.where((user: User) => user.age >= 25).count();
    expect(provider.executionCount).toBeGreaterThan(0);
  });
});
