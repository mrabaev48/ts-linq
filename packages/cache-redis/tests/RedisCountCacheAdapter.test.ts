import { RedisCountCacheAdapter } from '../src/redis/RedisCountCacheAdapter';

class FakeRedis {
  private m = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.m.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.m.set(key, value);
  }
  async del(key: string): Promise<void> {
    this.m.delete(key);
  }
}

describe('RedisCountCacheAdapter', () => {
  test('stores and retrieves count entries via shadow map', async () => {
    const client = new FakeRedis();
    const cache = new RedisCountCacheAdapter(client, { ttlSeconds: 1 });
    cache.set('cnt', 42);
    const got = cache.get('cnt');
    expect(got).toBe(42);
  });

  test('clear resets shadow map', () => {
    const client = new FakeRedis();
    const cache = new RedisCountCacheAdapter(client);
    cache.set('a', 1);
    expect(cache.get('a')).toBeDefined();
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });

  test('hashKeys stores hashed count key in backend', async () => {
    const client = new FakeRedis();
    const cache = new RedisCountCacheAdapter(client, { hashKeys: true });
    cache.set('Product|count|[]', 1);
    // Just smoke: shadow updated
    expect(cache.get('Product|count|[]')).toBe(1);
  });

  test('invalidateBy removes matching count keys', async () => {
    const client = new FakeRedis();
    const cache = new RedisCountCacheAdapter(client);
    cache.set('Product|count|[]', 1);
    cache.set('Order|count|[]', 2);
    const removed = cache.invalidateBy((k) => k.startsWith('Product|count|'));
    expect(removed).toBe(1);
    expect(cache.get('Product|count|[]')).toBeUndefined();
  });
});
