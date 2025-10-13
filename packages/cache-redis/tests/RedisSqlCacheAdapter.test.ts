import { RedisSqlCacheAdapter } from '../src/redis/RedisSqlCacheAdapter';
import type { SqlCacheEntry } from '@ts-linq/core';

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

describe('RedisSqlCacheAdapter', () => {
  test('stores and retrieves entries via shadow map; writes through to backend', async () => {
    const client = new FakeRedis();
    const cache = new RedisSqlCacheAdapter(client, { ttlSeconds: 1 });
    const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

    expect(cache.size()).toBe(0);
    cache.set('k1', entry);
    expect(cache.size()).toBe(1);
    const got = cache.get('k1');
    expect(got).toBeDefined();
    expect(got?.query).toBe('SELECT 1');

    const raw = await client.get('tslnq:sql:k1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as SqlCacheEntry;
    expect(parsed.query).toBe('SELECT 1');
  });

  test('clear resets shadow cache size', () => {
    const client = new FakeRedis();
    const cache = new RedisSqlCacheAdapter(client);
    cache.set('a', { query: 'Q', parameters: [] });
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
