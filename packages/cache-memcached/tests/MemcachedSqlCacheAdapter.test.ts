import { MemcachedSqlCacheAdapter } from '../src/memcached/MemcachedSqlCacheAdapter';
import type { SqlCacheEntry } from '@ts-linq/core';

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

describe('MemcachedSqlCacheAdapter', () => {
  test('stores and retrieves via shadow map and writes through', async () => {
    const client = new FakeMemjs();
    const cache = new MemcachedSqlCacheAdapter(client, { ttlSeconds: 1 });
    const entry: SqlCacheEntry = { query: 'SELECT 2', parameters: [] };
    cache.set('k', entry);
    const got = cache.get('k');
    expect(got?.query).toBe('SELECT 2');
    const raw = await client.get('tslnq:sql:k');
    expect(raw?.value).toBeInstanceOf(Buffer);
  });

  test('clear empties shadow map', () => {
    const client = new FakeMemjs();
    const cache = new MemcachedSqlCacheAdapter(client);
    cache.set('a', { query: 'x', parameters: [] });
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
