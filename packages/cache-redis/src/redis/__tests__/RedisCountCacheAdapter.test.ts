import { RedisCountCacheAdapter } from '../RedisCountCacheAdapter';
import type { CountCacheEntry } from '@ts-linq/core';

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
    const entry: CountCacheEntry = { value: 42, ts: Date.now() };
    cache.set('cnt', entry);
    const got = cache.get('cnt');
    expect(got?.value).toBe(42);
  });

  test('clear resets shadow map', () => {
    const client = new FakeRedis();
    const cache = new RedisCountCacheAdapter(client);
    cache.set('a', { value: 1, ts: Date.now() });
    expect(cache.get('a')).toBeDefined();
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });
});
