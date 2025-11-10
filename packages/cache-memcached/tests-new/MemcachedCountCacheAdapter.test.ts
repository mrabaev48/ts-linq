import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  MemcachedCountCacheAdapter,
  type MemjsClientLike
} from '../src/memcached/MemcachedCountCacheAdapter';

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
  await new Promise(resolve => setImmediate(resolve));
}

describe('MemcachedCountCacheAdapter', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  describe('shadow cache (LRU)', () => {
    it('should store and retrieve values from shadow cache', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 42);
      const result = cache.get('key1');

      expect(result).toBe(42);
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      const result = cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should enforce FIFO eviction when shadow cache is full', () => {
      const cache = new MemcachedCountCacheAdapter(client, { shadowMaxSize: 3 });

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.set('key4', 4);

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(2);
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });

    it('should implement LRU by moving accessed items to end', () => {
      const cache = new MemcachedCountCacheAdapter(client, { shadowMaxSize: 3 });

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.get('key1');
      cache.set('key4', 4);

      expect(cache.get('key1')).toBe(1);
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should expire entries based on shadowTtlMs', async () => {
      const cache = new MemcachedCountCacheAdapter(client, { shadowTtlMs: 50 });

      cache.set('key1', 42);
      expect(cache.get('key1')).toBe(42);

      await new Promise(resolve => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('write-through to Memcached', () => {
    it('should write to Memcached on set with default prefix', async () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('mykey', 123);
      await flushPromises();

      expect(client.calls.set).toHaveLength(1);
      expect(client.calls.set[0].key).toBe('tslnq:cnt:mykey');
      const payload = JSON.parse(client.calls.set[0].value);
      expect(payload.value).toBe(123);
      expect(payload.ts).toBeGreaterThan(0);
    });

    it('should use custom keyPrefix', async () => {
      const cache = new MemcachedCountCacheAdapter(client, { keyPrefix: 'custom:' });

      cache.set('mykey', 456);
      await flushPromises();

      expect(client.calls.set[0].key).toBe('custom:mykey');
    });

    it('should apply TTL via expires option when configured', async () => {
      const cache = new MemcachedCountCacheAdapter(client, { ttlSeconds: 300 });

      cache.set('mykey', 789);
      await flushPromises();

      expect(client.calls.set[0].options?.expires).toBe(300);
    });

    it('should omit TTL when not configured', async () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('mykey', 100);
      await flushPromises();

      expect(client.calls.set[0].options).toBeUndefined();
    });

    it('should hash keys when hashKeys is enabled', async () => {
      const cache = new MemcachedCountCacheAdapter(client, { hashKeys: true });

      cache.set('long-key-that-should-be-hashed', 42);
      await flushPromises();

      const key = client.calls.set[0].key;
      expect(key).toMatch(/^tslnq:cnt:[0-9a-f]+$/);
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

      const cache = new MemcachedCountCacheAdapter(failingClient);

      expect(() => cache.set('key', 42)).not.toThrow();
      expect(cache.get('key')).toBe(42);
    });
  });

  describe('clear()', () => {
    it('should clear shadow cache', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should increment invalidations by cleared count', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.clear();

      const metrics = cache.getMetrics();

      expect(metrics.invalidations).toBe(2);
    });
  });

  describe('invalidateBy()', () => {
    it('should invalidate matching keys from shadow cache', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('user:1', 1);
      cache.set('user:2', 2);
      cache.set('post:1', 3);

      const removed = cache.invalidateBy(k => k.startsWith('user:'));

      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBe(3);
    });

    it('should delete matching keys from Memcached', async () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      client.calls.delete = [];

      cache.invalidateBy(k => k === 'key1');
      await flushPromises();

      expect(client.calls.delete).toContain('tslnq:cnt:key1');
      expect(client.calls.delete).not.toContain('tslnq:cnt:key2');
    });

    it('should return 0 when no keys match', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      const removed = cache.invalidateBy(k => k === 'nonexistent');

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

      const cache = new MemcachedCountCacheAdapter(failingClient);

      cache.set('key1', 1);

      expect(() => cache.invalidateBy(k => k === 'key1')).not.toThrow();
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('metrics', () => {
    it('should track requests and hits', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.get('key1');
      cache.get('nonexistent');

      const metrics = cache.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.hits).toBe(1);
    });

    it('should track misses for expired TTL entries', async () => {
      const cache = new MemcachedCountCacheAdapter(client, { shadowTtlMs: 50 });

      cache.set('key1', 1);
      await new Promise(resolve => setTimeout(resolve, 60));
      cache.get('key1');

      const metrics = cache.getMetrics();

      expect(metrics.misses).toBe(1);
    });

    it('should track evictions', () => {
      const cache = new MemcachedCountCacheAdapter(client, { shadowMaxSize: 2 });

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      const metrics = cache.getMetrics();

      expect(metrics.evictions).toBe(1);
    });

    it('should track invalidations from invalidateBy', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.invalidateBy(k => k.startsWith('key'));

      const metrics = cache.getMetrics();

      expect(metrics.invalidations).toBe(2);
    });

    it('should report current size', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);

      const metrics = cache.getMetrics();

      expect(metrics.currentSize).toBe(2);
    });
  });

  describe('read-through from Memcached (async)', () => {
    it('should hydrate shadow cache from Memcached on miss', async () => {
      const mockClient: MemjsClientLike = {
        get: async (key: string) => {
          if (key === 'tslnq:cnt:remote-key') {
            return { value: Buffer.from(JSON.stringify({ value: 999, ts: Date.now() })) };
          }
          return { value: null };
        },
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedCountCacheAdapter(mockClient);

      const result = await cache.getAsync('remote-key');

      expect(result).toBe(999);
      expect(cache.get('remote-key')).toBe(999);
    });

    it('should handle malformed JSON from Memcached gracefully', async () => {
      const mockClient: MemjsClientLike = {
        get: async () => ({ value: Buffer.from('invalid-json') }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedCountCacheAdapter(mockClient);

      const result = await cache.getAsync('bad-key');

      expect(result).toBeUndefined();
    });

    it('should use hashKeys when reading from Memcached', async () => {
      let requestedKey = '';
      const mockClient: MemjsClientLike = {
        get: async (key: string) => {
          requestedKey = key;
          return { value: Buffer.from(JSON.stringify({ value: 42, ts: Date.now() })) };
        },
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedCountCacheAdapter(mockClient, { hashKeys: true });

      await cache.getAsync('long-key-to-hash');

      expect(requestedKey).toMatch(/^tslnq:cnt:[0-9a-f]+$/);
      expect(requestedKey.length).toBeLessThan(30);
    });

    it('should return undefined when remote store has no value', async () => {
      const mockClient: MemjsClientLike = {
        get: async () => ({ value: null }),
        set: async () => {},
        delete: async () => {}
      };
      const cache = new MemcachedCountCacheAdapter(mockClient);

      const result = await cache.getAsync('missing-key');

      expect(result).toBeUndefined();
    });
  });

  describe('constructor options', () => {
    it('should use defaults when no options provided', () => {
      const cache = new MemcachedCountCacheAdapter(client);

      const metrics = cache.getMetrics();

      expect(metrics).toBeDefined();
    });

    it('should accept all custom options', () => {
      const cache = new MemcachedCountCacheAdapter(client, {
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
