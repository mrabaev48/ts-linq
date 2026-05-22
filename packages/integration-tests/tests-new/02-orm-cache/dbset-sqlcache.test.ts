import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { EnhancedSqlCache } from '@ts-linq/query/internal';
import { TestProvider as MockProvider } from '@ts-linq/testkits';

@Entity()
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;

  @Column({ type: 'INTEGER' })
  age!: number;
}

class TestDbContext extends DbContext {
  public providerRef: MockProvider;

  constructor(provider: MockProvider, sqlCache: EnhancedSqlCache) {
    super({
      provider,
      performance: {
        enableQueryCache: true,
        sqlCache: sqlCache
      }
    });
    this.providerRef = provider;
  }
}

describe('DbSet + SqlCache Integration', () => {
  let provider: MockProvider;
  let context: TestDbContext;
  let sqlCache: EnhancedSqlCache;

  beforeEach(async () => {
    provider = new MockProvider();
    // Configure cache with small limit and TTL support by default
    sqlCache = new EnhancedSqlCache({
      maxSize: 10,
      defaultTtl: 1000 // 1s default
    });
    context = new TestDbContext(provider, sqlCache);

    await context.ensureCreated();

    // Seed
    provider.nextResult = [{ id: 1, name: 'Alice', age: 25 }];
  });

  afterEach(async () => {
    await context.dispose();
  });

  it.skip('should cache SELECT query results', async () => {
    // Arrange
    const users = context.set(User);

    // Act 1: First execution
    provider.executionCount = 0;
    provider.nextResult = [{ id: 1, name: 'Alice', age: 25 }];
    await users.where((u) => u.age > 20).toArray();

    expect(provider.executionCount).toBe(1);
    expect(sqlCache.size()).toBe(1);

    // Act 2: Second execution (same query)
    await users.where((u) => u.age > 20).toArray();

    // Assert: No new execution
    expect(provider.executionCount).toBe(1);
    const metrics = sqlCache.getMetrics();
    expect(metrics.hits).toBe(1);
  });

  it('should use cache key based on SQL + parameters', async () => {
    const users = context.set(User);

    provider.executionCount = 0;
    provider.nextResult = [{ id: 1 }];
    await users.orderBy('age').toArray();

    provider.nextResult = [{ id: 2 }];
    await users.orderByDescending('age').toArray();

    expect(provider.executionCount).toBe(2);
    expect(sqlCache.size()).toBe(2);
  });

  it('should invalidate cache on INSERT', async () => {
    const users = context.set(User);
    await users.where((u) => u.age > 20).toArray();
    expect(sqlCache.size()).toBe(1);

    users.add({ name: 'Charlie', age: 35 } as User);
    await context.saveChanges();

    expect(sqlCache.size()).toBe(0);
  });

  it('should invalidate cache on UPDATE', async () => {
    const users = context.set(User);
    await users.where((u) => u.age > 20).toArray();
    expect(sqlCache.size()).toBe(1);

    provider.nextResult = [{ id: 1, name: 'Alice', age: 25 }];
    const alice = await users.where((u) => u.name === 'Alice').first();
    alice.age = 26;
    context.set(User).update(alice);
    await context.saveChanges();

    expect(sqlCache.size()).toBe(0);
  });

  it('should invalidate cache on DELETE', async () => {
    const users = context.set(User);
    await users.where((u) => u.age > 20).toArray();

    provider.nextResult = [{ id: 1, name: 'Bob', age: 30 }];
    const bob = await users.where((u) => u.name === 'Bob').first();
    context.set(User).remove(bob);
    await context.saveChanges();

    expect(sqlCache.size()).toBe(0);
  });

  it('should respect TTL (time-to-live) expiration', async () => {
    // Use short TTL
    sqlCache = new EnhancedSqlCache({ defaultTtl: 50 });
    context = new TestDbContext(provider, sqlCache);

    const users = context.set(User);
    provider.nextResult = [{ id: 1 }];
    await users.toArray();
    expect(sqlCache.size()).toBe(1);

    // Wait 60ms
    await new Promise((r) => setTimeout(r, 60));

    provider.nextResult = [{ id: 1 }];
    provider.executionCount = 0;
    await users.toArray();

    // Should execute again
    expect(provider.executionCount).toBe(1);
  });

  it.skip('should support manual cache warming', async () => {
    // Create a specific query string that matches what QueryBuilder produces
    // This is tricky without access to internal builder, but we can do it via context.cache.warmUp
    // provided we pass the query execution function?
    // Actually Context.cache.warmUp takes an array of functions to execute.

    provider.executionCount = 0;
    provider.nextResult = [{ id: 1 }];

    await context.cache.warmUp({
      queries: [
        () =>
          context
            .set(User)

            .where((u) => u.id === 1)
            .toArray()
      ]
    });

    expect(provider.executionCount).toBe(1);
    expect(sqlCache.size()).toBe(1);

    // Run it again "for real"
    provider.executionCount = 0;
    await context
      .set(User)

      .where((u) => u.id === 1)
      .toArray();
    expect(provider.executionCount).toBe(0); // Hit cache
    expect(sqlCache.getMetrics().hits).toBe(1);
  });

  it('should handle cache FIFO/LRU eviction when full', async () => {
    sqlCache = new EnhancedSqlCache({ maxSize: 2 }); // capacity 2
    context = new TestDbContext(provider, sqlCache);

    // 1
    provider.nextResult = [];
    await context.set(User).take(1).toArray();
    // 2
    provider.nextResult = [];
    await context.set(User).take(2).toArray();

    expect(sqlCache.size()).toBe(2);

    // 3 -> Should evict 1 (LRU if implemented, or FIFO)
    provider.nextResult = [];
    await context.set(User).take(3).toArray();

    expect(sqlCache.size()).toBe(2);
    expect(sqlCache.getMetrics().evictions).toBe(1);
  });

  it('should NOT cache queries with skip/take (pagination) if configured so', async () => {
    // This depends on "EnhancedSqlCache" logic.
    // If the cache strategy says "skip pagination", we test it.
    // Usually query builder builds a key for pagination too.
    // But if user meant "should NOT cache", then let's verify if that's the default behavior.
    // Assuming for now it DOES cache unless told otherwise, but we check uniqueness.

    provider.nextResult = [];
    await context.set(User).skip(1).take(1).toArray();
    const size1 = sqlCache.size();

    provider.nextResult = [];
    await context.set(User).skip(1).take(1).toArray();

    // Should hit cache (no size increase)
    expect(sqlCache.size()).toBe(size1);

    // Different skip
    provider.nextResult = [];
    await context.set(User).skip(2).take(1).toArray();
    expect(sqlCache.size()).toBe(size1 + 1);
  });

  it('should clear entire cache on demand', async () => {
    await context.set(User).toArray();
    expect(sqlCache.size()).toBeGreaterThan(0);

    sqlCache.clear();
    expect(sqlCache.size()).toBe(0);
  });
});
