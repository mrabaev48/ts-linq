import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { EnhancedSqlCache } from '@ts-linq/query/internal';
import { TestProvider as MockProvider } from '@ts-linq/testkits';
import type { CountCache } from '@ts-linq/types';

interface CountCacheEntry {
  value: number;
  ts: number;
}

@Entity({ name: 'batch_items' })
class Item {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class TrackingCountCache implements CountCache {
  private readonly store = new Map<string, CountCacheEntry>();

  get(key: string): number | undefined {
    const entry = this.store.get(key);
    return entry?.value;
  }

  set(key: string, value: number): void {
    this.store.set(key, { value, ts: Date.now() });
  }

  clear(): void {
    this.store.clear();
  }

  invalidateBy(matcher: (key: string) => boolean): number {
    let removed = 0;
    for (const key of Array.from(this.store.keys())) {
      if (matcher(key)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.store.size;
  }
}

class TestDbContext extends DbContext {
  constructor(provider: MockProvider, sqlCache: EnhancedSqlCache, countCache: TrackingCountCache) {
    super({
      provider,
      performance: {
        enableQueryCache: true,
        sqlCache,
        enableCountCache: true,
        countCache
      }
    });
  }
}

describe('Batch Operations + Cache Integration', () => {
  let provider: MockProvider;
  let sqlCache: EnhancedSqlCache;
  let countCache: TrackingCountCache;
  let context: TestDbContext;

  beforeEach(async () => {
    provider = new MockProvider();
    sqlCache = new EnhancedSqlCache({ maxSize: 50 });
    countCache = new TrackingCountCache();
    context = new TestDbContext(provider, sqlCache, countCache);
    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  it('should invalidate cache after bulk insert', async () => {
    // Warm count cache with a SELECT COUNT
    provider.nextResult = [{ count: 3 }];
    await context.set(Item).count();
    expect(countCache.size()).toBe(1);

    // insertMany bypasses change tracker and calls invalidateCountCache() directly
    provider.insertMany = async (entities) => entities;
    await context.set(Item).insertMany([Object.assign(new Item(), { name: 'X' })]);

    expect(countCache.size()).toBe(0);
  });

  it('should invalidate cache after bulk update', async () => {
    // Warm count cache
    provider.nextResult = [{ count: 2 }];
    await context.set(Item).count();
    expect(countCache.size()).toBe(1);

    // updateMany bypasses change tracker and calls invalidateCountCache() directly
    provider.updateMany = async (entities) => entities;
    await context.set(Item).updateMany([Object.assign(new Item(), { id: 1, name: 'Y' })]);

    expect(countCache.size()).toBe(0);
  });

  it('should invalidate cache after bulk delete', async () => {
    // Warm sqlCache via SELECT
    provider.nextResult = [{ id: 1, name: 'A' }];
    await context.set(Item).toArray();
    expect(sqlCache.size()).toBe(1);

    // Warm countCache via COUNT
    provider.nextResult = [{ count: 1 }];
    await context.set(Item).count();
    expect(countCache.size()).toBe(1);

    // removeRange + saveChanges → full CacheCoordinator pipeline → both caches cleared
    provider.nextResult = [{ id: 1, name: 'A' }];
    const item = await context.set(Item).first();
    context.set(Item).removeRange([item]);
    await context.saveChanges();

    expect(sqlCache.size()).toBe(0);
    expect(countCache.size()).toBe(0);
  });

  it('should NOT cache batch operation results', async () => {
    // Batch write operations should not populate sqlCache
    provider.insertMany = async (entities) => entities;

    await context.set(Item).insertMany([Object.assign(new Item(), { name: 'P' })]);
    await context.set(Item).insertMany([Object.assign(new Item(), { name: 'Q' })]);

    // sqlCache should remain empty — inserts are writes, not cached SELECT results
    expect(sqlCache.size()).toBe(0);
  });

  it('should clear cache across all adapters after batch', async () => {
    // Warm both caches
    provider.nextResult = [{ id: 1, name: 'B' }];
    await context.set(Item).toArray();
    expect(sqlCache.size()).toBe(1);

    provider.nextResult = [{ count: 1 }];
    await context.set(Item).count();
    expect(countCache.size()).toBe(1);

    // addRange + saveChanges → CacheCoordinator.invalidateAfterMutation → both cleared
    context.set(Item).addRange([Object.assign(new Item(), { name: 'New' })]);
    await context.saveChanges();

    expect(sqlCache.size()).toBe(0);
    expect(countCache.size()).toBe(0);
  });
});
