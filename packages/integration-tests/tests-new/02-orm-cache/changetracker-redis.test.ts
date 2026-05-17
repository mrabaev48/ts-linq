import { RedisClientLike, RedisEntityCacheAdapter } from '@ts-linq/cache-redis';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import { TestProvider as MockProvider } from '@ts-linq/testkits';

@Entity({ name: 'cached_items' })
class CachedItem {
  @PrimaryKey()
  public id!: number;

  @Column()
  public data!: string;

  @Column({ type: 'DATE' })
  public createdAt!: Date;
}

// Mock Redis Client
class MockRedisClient implements RedisClientLike {
  public store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown> {
    this.store.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<unknown> {
    this.store.delete(key);
    return 1;
  }
}

describe('ChangeTracker + Redis Cache Integration', () => {
  let mockRedis: MockRedisClient;
  let cacheAdapter: RedisEntityCacheAdapter;
  let provider: MockProvider;

  // Custom serializer to handle Date objects roughly like standardized formats
  const serializer = (obj: unknown) =>
    JSON.stringify(obj, (key, value) => {
      // ensure dates are serialized as ISO strings (standard JSON behavior)
      return value;
    });

  const deserializer = (str: string) =>
    JSON.parse(str, (key, value) => {
      // simplistic date reviver
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      return value;
    });

  beforeEach(() => {
    mockRedis = new MockRedisClient();
    cacheAdapter = new RedisEntityCacheAdapter(mockRedis, {
      serializer,
      deserializer,
      keyPrefix: 'test:'
    });
    provider = new MockProvider();
  });

  it('should store entities in Redis on set via shadow cache', () => {
    const item = new CachedItem();
    item.id = 1;
    item.data = 'test-data';
    item.createdAt = new Date('2023-01-01');

    cacheAdapter.set(CachedItem, item.id, item);

    // Should be in shadow immediately
    const fromCache = cacheAdapter.get<CachedItem>(CachedItem, 1);
    expect(fromCache).toBe(item);

    // Async write to Redis should happen
    // We wait a tick for the async void promise
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const redisKey = 'test:CachedItem|1';
        const stored = await mockRedis.get(redisKey);
        expect(stored).toBeDefined();
        const parsed = deserializer(stored!) as CachedItem;
        expect(parsed.id).toBe(1);
        expect(parsed.data).toBe('test-data');
        expect(parsed.createdAt).toBeInstanceOf(Date);
        expect(parsed.createdAt.toISOString()).toBe(item.createdAt.toISOString());
        resolve();
      }, 10);
    });
  });

  it('should remove entities from Redis on remove', () => {
    const item = new CachedItem();
    item.id = 2;
    cacheAdapter.set(CachedItem, 2, item);

    cacheAdapter.remove(CachedItem, 2);

    expect(cacheAdapter.get(CachedItem, 2)).toBeUndefined();

    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const redisKey = 'test:CachedItem|2';
        const stored = await mockRedis.get(redisKey);
        expect(stored).toBeNull();
        resolve();
      }, 10);
    });
  });

  it('should populate shadow on get failure (async fetch)', () => {
    // Manually seed Redis
    const redisKey = 'test:CachedItem|3';
    const raw = serializer({ id: 3, data: 'from-redis', createdAt: new Date() });
    mockRedis.store.set(redisKey, raw);

    // Get should return undefined first time (shadow (L1) miss)
    const firstTry = cacheAdapter.get(CachedItem, 3);
    expect(firstTry).toBeUndefined();

    // But it should have triggered a fetch
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Second try, assuming async fetch completed
        const secondTry = cacheAdapter.get<CachedItem>(CachedItem, 3);
        expect(secondTry).toBeDefined();
        expect(secondTry?.data).toBe('from-redis');
        resolve();
      }, 10);
    });
  });

  it('should integrate with DbContext and invalidate on changes', async () => {
    class TestDbContext extends DbContext {}
    const context = new TestDbContext({
      provider,
      performance: {
        enableEntityCache: true,
        entityCache: cacheAdapter
      }
    });

    const set = context.set(CachedItem);

    // 1. Add item
    const item = new CachedItem();
    item.id = 10;
    item.data = 'original';

    // Mock insert returning the item
    provider.insert = async <T extends object>(entity: T) => entity;

    set.add(item);
    await context.saveChanges();

    // Should adhere to cache (DbContext updates cache on Add)
    const cached = cacheAdapter.get<CachedItem>(CachedItem, 10);
    expect(cached).toBeDefined();
    expect(cached?.data).toBe('original');

    // 2. Remove item
    set.remove(item);
    provider.delete = async () => {};

    await context.saveChanges();

    // Should be removed from cache
    const cachedAfterDelete = cacheAdapter.get(CachedItem, 10);
    expect(cachedAfterDelete).toBeUndefined();

    // Redis check
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const redisKey = 'test:CachedItem|10';
        const stored = await mockRedis.get(redisKey);
        expect(stored).toBeNull();
        resolve();
      }, 10);
    });
  });
});
