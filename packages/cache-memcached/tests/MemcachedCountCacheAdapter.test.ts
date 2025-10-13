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
  test('stores and retrieves count via shadow map', async () => {
    const client = new FakeMemjs();
    const cache = new MemcachedCountCacheAdapter(client, { ttlSeconds: 1 });
    cache.set('c', { value: 5, ts: Date.now() });
    const got = cache.get('c');
    expect(got?.value).toBe(5);
  });

  test('clear empties shadow map', () => {
    const client = new FakeMemjs();
    const cache = new MemcachedCountCacheAdapter(client);
    cache.set('k', { value: 1, ts: Date.now() });
    expect(cache.get('k')).toBeDefined();
    cache.clear();
    expect(cache.get('k')).toBeUndefined();
  });
});
