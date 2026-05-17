import { beforeEach, describe, expect, it } from '@jest/globals';
import type { SqlCacheEntry } from '@ts-linq/types';

import {
  MemcachedSqlCacheAdapter,
  type MemjsClientLike
} from '../src/memcached/MemcachedSqlCacheAdapter';

function createMockClient(): MemjsClientLike & {
  calls: { get: string[]; set: any[]; delete: string[] };
} {
  const calls = { get: [] as string[], set: [] as any[], delete: [] as string[] };
  return {
    calls,
    async get(key: string) {
      calls.get.push(key);
      return { value: null };
    },
    async set(key: string, value: Buffer | string, options?: { expires?: number }) {
      calls.set.push({ key, value: value.toString(), options });
    },
    async delete(key: string) {
      calls.delete.push(key);
    }
  };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('MemcachedSqlCacheAdapter', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  describe('shadow cache (LRU)', () => {
    it('should store and retrieve SQL entries from shadow cache', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = {
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: [1]
      };

      cache.set('key1', entry);
      const result = cache.get('key1');

      expect(result).toEqual(entry);
    });

    it('should clone parameters to prevent mutations', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const params = [1, 'test'];
      const entry: SqlCacheEntry = {
        query: 'SELECT * FROM users',
        parameters: params
      };

      cache.set('key1', entry);
      params.push('mutated');
      const result = cache.get('key1');

      expect(result?.parameters).toEqual([1, 'test']);
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new MemcachedSqlCacheAdapter(client);

      const result = cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should enforce FIFO eviction when shadow cache is full', () => {
      const cache = new MemcachedSqlCacheAdapter(client, { shadowMaxSize: 3 });
      const makeEntry = (n: number): SqlCacheEntry => ({
        query: `SELECT ${n}`,
        parameters: []
      });

      cache.set('key1', makeEntry(1));
      cache.set('key2', makeEntry(2));
      cache.set('key3', makeEntry(3));
      cache.set('key4', makeEntry(4));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
      expect(cache.get('key3')).toBeDefined();
      expect(cache.get('key4')).toBeDefined();
    });

    it('should implement LRU by moving accessed items to end', () => {
      const cache = new MemcachedSqlCacheAdapter(client, { shadowMaxSize: 3 });
      const makeEntry = (n: number): SqlCacheEntry => ({
        query: `SELECT ${n}`,
        parameters: []
      });

      cache.set('key1', makeEntry(1));
      cache.set('key2', makeEntry(2));
      cache.set('key3', makeEntry(3));
      cache.get('key1');
      cache.set('key4', makeEntry(4));

      expect(cache.get('key1')).toBeDefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should expire entries based on shadowTtlMs', async () => {
      const cache = new MemcachedSqlCacheAdapter(client, { shadowTtlMs: 50 });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      expect(cache.get('key1')).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('write-through to Memcached', () => {
    it('should write to Memcached on set with default prefix', async () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = {
        query: 'SELECT * FROM users',
        parameters: [1, 'test']
      };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set).toHaveLength(1);
      expect(client.calls.set[0].key).toBe('tslnq:sql:mykey');
      const payload = JSON.parse(client.calls.set[0].value);
      expect(payload.query).toBe(entry.query);
      expect(payload.parameters).toEqual(entry.parameters);
    });

    it('should use custom keyPrefix', async () => {
      const cache = new MemcachedSqlCacheAdapter(client, { keyPrefix: 'app:sql:' });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set[0].key).toBe('app:sql:mykey');
    });

    it('should apply TTL via expires option when configured', async () => {
      const cache = new MemcachedSqlCacheAdapter(client, { ttlSeconds: 600 });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set[0].options?.expires).toBe(600);
    });

    it('should omit TTL when not configured', async () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set[0].options).toBeUndefined();
    });

    it('should hash keys when hashKeys is enabled', async () => {
      const cache = new MemcachedSqlCacheAdapter(client, { hashKeys: true });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('very-long-key-that-should-be-hashed', entry);
      await flushPromises();

      const key = client.calls.set[0].key;
      expect(key).toMatch(/^tslnq:sql:[0-9a-f]+$/);
      expect(key.length).toBeLessThan(30);
    });

    it('should handle write-through failures silently', async () => {
      const failingClient: MemjsClientLike = {
        get: async () => ({ value: null }),
        set: async () => {
          throw new Error('Memcached down');
        },
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(failingClient);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      expect(() => cache.set('key', entry)).not.toThrow();
      expect(cache.get('key')).toEqual(entry);
    });
  });

  describe('clear()', () => {
    it('should clear shadow cache', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should increment invalidations by cleared count', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      cache.clear();

      const metrics = cache.getMetrics();

      expect(metrics.invalidations).toBe(2);
    });
  });

  describe('size()', () => {
    it('should return shadow cache size', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      expect(cache.size()).toBe(0);

      cache.set('key1', entry);
      cache.set('key2', entry);

      expect(cache.size()).toBe(2);
    });
  });

  describe('invalidateBy()', () => {
    it('should invalidate matching keys from shadow cache', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('user:1', entry);
      cache.set('user:2', entry);
      cache.set('post:1', entry);

      const removed = cache.invalidateBy((k) => k.startsWith('user:'));

      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBeDefined();
    });

    it('should delete matching keys from Memcached', async () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      client.calls.delete = [];

      cache.invalidateBy((k) => k === 'key1');
      await flushPromises();

      expect(client.calls.delete).toContain('tslnq:sql:key1');
      expect(client.calls.delete).not.toContain('tslnq:sql:key2');
    });

    it('should return 0 when no keys match', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      const removed = cache.invalidateBy((k) => k === 'nonexistent');

      expect(removed).toBe(0);
    });

    it('should handle delete failures silently', async () => {
      const failingClient: MemjsClientLike = {
        get: async () => ({ value: null }),
        set: async () => {},
        delete: async () => {
          throw new Error('Memcached down');
        }
      };

      const cache = new MemcachedSqlCacheAdapter(failingClient);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);

      expect(() => cache.invalidateBy((k) => k === 'key1')).not.toThrow();
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('metrics', () => {
    it('should track requests and hits', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.get('key1');
      cache.get('nonexistent');

      const metrics = cache.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.hits).toBe(1);
    });

    it('should track misses for expired TTL entries', async () => {
      const cache = new MemcachedSqlCacheAdapter(client, { shadowTtlMs: 50 });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      await new Promise((resolve) => setTimeout(resolve, 60));
      cache.get('key1');

      const metrics = cache.getMetrics();

      expect(metrics.misses).toBe(1);
    });

    it('should track evictions', () => {
      const cache = new MemcachedSqlCacheAdapter(client, { shadowMaxSize: 2 });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      cache.set('key3', entry);

      const metrics = cache.getMetrics();

      expect(metrics.evictions).toBe(1);
    });

    it('should track invalidations from invalidateBy', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      cache.invalidateBy((k) => k.startsWith('key'));

      const metrics = cache.getMetrics();

      expect(metrics.invalidations).toBe(2);
    });

    it('should report current size via getMetrics', () => {
      const cache = new MemcachedSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);

      const metrics = cache.getMetrics();

      expect(metrics.currentSize).toBe(2);
    });
  });

  describe('read-through from Memcached (async)', () => {
    it('should hydrate shadow cache from Memcached on miss', async () => {
      const entry: SqlCacheEntry = {
        query: 'SELECT * FROM remote',
        parameters: [1, 'test']
      };
      const mockClient: MemjsClientLike = {
        get: async (key: string) => {
          if (key === 'tslnq:sql:remote-key') {
            return { value: Buffer.from(JSON.stringify(entry)) };
          }
          return { value: null };
        },
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(mockClient);

      const result = await cache.getAsync('remote-key');

      expect(result).toEqual(entry);
      expect(cache.get('remote-key')).toEqual(entry);
    });

    it('should clone parameters from Memcached read-through', async () => {
      const mockClient: MemjsClientLike = {
        get: async () => ({
          value: Buffer.from(JSON.stringify({ query: 'SELECT 1', parameters: [1, 'test'] }))
        }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(mockClient);

      const result1 = await cache.getAsync('key');
      const result2 = await cache.getAsync('key');

      expect(result1).not.toBe(result2);
      expect(result1?.parameters).not.toBe(result2?.parameters);
    });

    it('should handle malformed JSON from Memcached gracefully', async () => {
      const mockClient: MemjsClientLike = {
        get: async () => ({ value: Buffer.from('invalid-json') }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(mockClient);

      const result = await cache.getAsync('bad-key');

      expect(result).toBeUndefined();
    });

    it('should return undefined when remote store has no value', async () => {
      const mockClient: MemjsClientLike = {
        get: async () => ({ value: null }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(mockClient);

      const result = await cache.getAsync('missing-key');

      expect(result).toBeUndefined();
    });

    it('should track metrics correctly for async read-through hits', async () => {
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };
      const mockClient: MemjsClientLike = {
        get: async () => ({ value: Buffer.from(JSON.stringify(entry)) }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(mockClient);

      await cache.getAsync('key1');
      await cache.getAsync('key2');
      const result = await cache.getAsync('key1');

      expect(result).toEqual(entry);
      const metrics = cache.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(2);
    });

    it('should track metrics correctly for async read-through misses', async () => {
      const mockClient: MemjsClientLike = {
        get: async () => ({ value: null }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedSqlCacheAdapter(mockClient);

      await cache.getAsync('missing1');
      await cache.getAsync('missing2');

      const metrics = cache.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(2);
    });
  });

  describe('constructor options', () => {
    it('should use defaults when no options provided', () => {
      const cache = new MemcachedSqlCacheAdapter(client);

      expect(cache.size()).toBe(0);
    });

    it('should accept all custom options', () => {
      const cache = new MemcachedSqlCacheAdapter(client, {
        ttlSeconds: 600,
        keyPrefix: 'app:',
        shadowMaxSize: 5000,
        shadowTtlMs: 30000,
        hashKeys: true
      });

      expect(cache).toBeDefined();
    });
  });
});
