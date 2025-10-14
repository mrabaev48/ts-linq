import { RedisSqlCacheAdapter } from '../src/redis/RedisSqlCacheAdapter';
import type { SqlCacheEntry } from '@ts-linq/core';

class FlakyRedis {
  private m = new Map<string, string>();
  public fail = true;
  async get(key: string): Promise<string | null> {
    return this.m.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    if (this.fail) throw new Error('backend down');
    this.m.set(key, value);
  }
  async del(): Promise<void> {}
}

describe('RedisSqlCacheAdapter writeThrough', () => {
  test('writeThrough=false does not call backend', async () => {
    const client = new FlakyRedis();
    const cache = new RedisSqlCacheAdapter(client, { writeThrough: false });
    const entry: SqlCacheEntry = { query: 'Q', parameters: [1] };
    cache.set('k', entry);
    expect(cache.get('k')?.parameters).toEqual([1]);
    expect(await client.get('tslnq:sql:k')).toBeNull();
  });

  test('writeThrough=true ignores backend errors (shadow still works)', async () => {
    const client = new FlakyRedis();
    const cache = new RedisSqlCacheAdapter(client, { writeThrough: true });
    cache.set('k', { query: 'Q2', parameters: [] });
    expect(cache.get('k')?.query).toBe('Q2');
  });
});
