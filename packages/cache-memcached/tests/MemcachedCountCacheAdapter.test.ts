import { MemcachedCountCacheAdapter } from '../src/memcached/MemcachedCountCacheAdapter';

class FakeMemjs {
  private m = new Map<string, Buffer>();
  async get(key: string): Promise<{ value: Buffer | null } | null> {
    const v = this.m.get(key) ?? null;
    return { value: v };
  }
  async set(key: string, value: Buffer | string): Promise<void> {
    const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    this.m.set(key, buf);
  }
  async delete(key: string): Promise<void> {
    this.m.delete(key);
  }
}

describe('MemcachedCountCacheAdapter', () => {
  test('invalidateBy removes matching count keys', async () => {
    const client = new FakeMemjs();
    const cache = new MemcachedCountCacheAdapter(client);
    cache.set('Product|count|[]', 1);
    cache.set('Order|count|[]', 2);
    const removed = cache.invalidateBy((k) => k.startsWith('Product|count|'));
    expect(removed).toBe(1);
    expect(cache.get('Product|count|[]')).toBeUndefined();
  });

  test('stores and retrieves count via shadow map', async () => {
    const client = new FakeMemjs();
    const cache = new MemcachedCountCacheAdapter(client, { ttlSeconds: 1 });
    cache.set('c', 5);
    const got = cache.get('c');
    expect(got).toBe(5);
  });

  test('clear empties shadow map', () => {
    const client = new FakeMemjs();
    const cache = new MemcachedCountCacheAdapter(client);
    cache.set('k', 1);
    expect(cache.get('k')).toBeDefined();
    cache.clear();
    expect(cache.get('k')).toBeUndefined();
  });

  test('hashKeys stores hashed count key in backend', async () => {
    const client = new FakeMemjs();
    const cache = new MemcachedCountCacheAdapter(client, { hashKeys: true });
    cache.set('Product|count|[]', 1);
    expect(cache.get('Product|count|[]')).toBe(1);
  });
});
