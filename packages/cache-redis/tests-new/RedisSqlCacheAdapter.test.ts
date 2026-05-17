import { beforeEach, describe, expect, it } from '@jest/globals';
import type { SqlCacheEntry } from '@ts-linq/types';

import {
  type RedisClientLike,
  type RedisPublisherLike,
  RedisSqlCacheAdapter,
  type RedisSubscriberLike
} from '../src/redis/RedisSqlCacheAdapter';

function createMockClient(): RedisClientLike & {
  calls: { get: string[]; set: any[]; del: string[] };
} {
  const calls = { get: [] as string[], set: [] as any[], del: [] as string[] };
  return {
    calls,
    async get(key: string) {
      calls.get.push(key);
      return null;
    },
    async set(key: string, value: string, mode?: string, ttl?: number) {
      calls.set.push({ key, value, mode, ttl });
    },
    async del(key: string) {
      calls.del.push(key);
    }
  };
}

function createMockPubSub() {
  const handlers = new Map<string, (message: string) => void>();
  const published: Array<{ channel: string; message: string }> = [];

  const subscriber: RedisSubscriberLike = {
    subscribe(channel: string, handler: (message: string) => void) {
      handlers.set(channel, handler);
    }
  };

  const publisher: RedisPublisherLike = {
    publish(channel: string, message: string) {
      published.push({ channel, message });
    }
  };

  const triggerMessage = (channel: string, message: string) => {
    const handler = handlers.get(channel);
    if (handler) handler(message);
  };

  return { subscriber, publisher, published, triggerMessage };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('RedisSqlCacheAdapter', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  describe('shadow cache (LRU)', () => {
    it('should store and retrieve SQL entries from shadow cache', () => {
      const cache = new RedisSqlCacheAdapter(client);
      const entry: SqlCacheEntry = {
        query: 'SELECT * FROM users WHERE id = ?',
        parameters: [1]
      };

      cache.set('key1', entry);
      const result = cache.get('key1');

      expect(result).toEqual(entry);
    });

    it('should clone parameters to prevent mutations', () => {
      const cache = new RedisSqlCacheAdapter(client);
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
      const cache = new RedisSqlCacheAdapter(client);

      const result = cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should enforce FIFO eviction when shadow cache is full', () => {
      const cache = new RedisSqlCacheAdapter(client, { shadowMaxSize: 3 });
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
      const cache = new RedisSqlCacheAdapter(client, { shadowMaxSize: 3 });
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
      const cache = new RedisSqlCacheAdapter(client, { shadowTtlMs: 50 });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      expect(cache.get('key1')).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('write-through to Redis', () => {
    it('should write to Redis on set with default prefix', async () => {
      const cache = new RedisSqlCacheAdapter(client);
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
      const cache = new RedisSqlCacheAdapter(client, { keyPrefix: 'app:sql:' });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set[0].key).toBe('app:sql:mykey');
    });

    it('should apply TTL when configured', async () => {
      const cache = new RedisSqlCacheAdapter(client, { ttlSeconds: 600 });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set[0].mode).toBe('EX');
      expect(client.calls.set[0].ttl).toBe(600);
    });

    it('should omit TTL when not configured', async () => {
      const cache = new RedisSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set[0].mode).toBeUndefined();
      expect(client.calls.set[0].ttl).toBeUndefined();
    });

    it('should hash keys when hashKeys is enabled', async () => {
      const cache = new RedisSqlCacheAdapter(client, { hashKeys: true });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('very-long-key-that-should-be-hashed', entry);
      await flushPromises();

      const key = client.calls.set[0].key;
      expect(key).toMatch(/^tslnq:sql:[0-9a-f]+$/);
      expect(key.length).toBeLessThan(30);
    });

    it('should skip write-through when writeThrough is false', async () => {
      const cache = new RedisSqlCacheAdapter(client, { writeThrough: false });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('mykey', entry);
      await flushPromises();

      expect(client.calls.set).toHaveLength(0);
      expect(cache.get('mykey')).toEqual(entry);
    });

    it('should handle write-through failures silently', async () => {
      const failingClient: RedisClientLike = {
        get: async () => null,
        set: async () => {
          throw new Error('Redis down');
        },
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(failingClient);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      expect(() => cache.set('key', entry)).not.toThrow();
      expect(cache.get('key')).toEqual(entry);
    });
  });

  describe('clear()', () => {
    it('should clear shadow cache', () => {
      const cache = new RedisSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should broadcast clear message via pub/sub', () => {
      const { subscriber, publisher, published } = createMockPubSub();
      const cache = new RedisSqlCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber,
        publisher
      });

      cache.clear();

      expect(published).toHaveLength(1);
      expect(published[0].channel).toBe('invalidate');
      const msg = JSON.parse(published[0].message);
      expect(msg.t).toBe('clear');
    });
  });

  describe('size()', () => {
    it('should return shadow cache size', () => {
      const cache = new RedisSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      expect(cache.size()).toBe(0);

      cache.set('key1', entry);
      cache.set('key2', entry);

      expect(cache.size()).toBe(2);
    });
  });

  describe('invalidateBy()', () => {
    it('should invalidate matching keys from shadow cache', () => {
      const cache = new RedisSqlCacheAdapter(client);
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

    it('should delete matching keys from Redis', async () => {
      const cache = new RedisSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);
      client.calls.del = [];

      cache.invalidateBy((k) => k === 'key1');
      await flushPromises();

      expect(client.calls.del).toContain('tslnq:sql:key1');
      expect(client.calls.del).not.toContain('tslnq:sql:key2');
    });

    it('should broadcast delete messages via pub/sub', () => {
      const { subscriber, publisher, published } = createMockPubSub();
      const cache = new RedisSqlCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber,
        publisher
      });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.invalidateBy((k) => k === 'key1');

      expect(published.length).toBeGreaterThan(0);
      const deleteMsg = published.find((p) => {
        const msg = JSON.parse(p.message);
        return msg.t === 'del' && msg.k === 'key1';
      });
      expect(deleteMsg).toBeDefined();
    });

    it('should return 0 when no keys match', () => {
      const cache = new RedisSqlCacheAdapter(client);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      const removed = cache.invalidateBy((k) => k === 'nonexistent');

      expect(removed).toBe(0);
    });

    it('should handle remote delete failures silently', async () => {
      const failingClient: RedisClientLike = {
        get: async () => null,
        set: async () => {},
        del: async () => {
          throw new Error('Redis down');
        }
      };
      const cache = new RedisSqlCacheAdapter(failingClient);
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);

      expect(() => cache.invalidateBy((k) => k === 'key1')).not.toThrow();
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('pub/sub cross-instance invalidation', () => {
    it('should clear shadow cache when receiving clear message', () => {
      const { subscriber, triggerMessage } = createMockPubSub();
      const cache = new RedisSqlCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber
      });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);

      triggerMessage('invalidate', JSON.stringify({ t: 'clear' }));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should delete specific key when receiving del message', () => {
      const { subscriber, triggerMessage } = createMockPubSub();
      const cache = new RedisSqlCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber
      });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);
      cache.set('key2', entry);

      triggerMessage('invalidate', JSON.stringify({ t: 'del', k: 'key1' }));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
    });

    it('should ignore malformed pub/sub messages', () => {
      const { subscriber, triggerMessage } = createMockPubSub();
      const cache = new RedisSqlCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber
      });
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };

      cache.set('key1', entry);

      triggerMessage('invalidate', 'not-json');
      triggerMessage('invalidate', JSON.stringify({ invalid: 'format' }));

      expect(cache.get('key1')).toBeDefined();
    });
  });

  describe('read-through from Redis (async)', () => {
    it('should hydrate shadow cache from Redis on miss', async () => {
      const entry: SqlCacheEntry = {
        query: 'SELECT * FROM remote',
        parameters: [1, 'test']
      };
      const mockClient: RedisClientLike = {
        get: async (key: string) => {
          if (key === 'tslnq:sql:remote-key') {
            return JSON.stringify(entry);
          }
          return null;
        },
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(mockClient);

      const result = await cache.getAsync('remote-key');

      expect(result).toEqual(entry);
      expect(cache.get('remote-key')).toEqual(entry);
    });

    it('should clone parameters from Redis read-through', async () => {
      const mockClient: RedisClientLike = {
        get: async () => JSON.stringify({ query: 'SELECT 1', parameters: [1, 'test'] }),
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(mockClient);

      const result1 = await cache.getAsync('key');
      const result2 = await cache.getAsync('key');

      expect(result1).not.toBe(result2);
      expect(result1?.parameters).not.toBe(result2?.parameters);
    });

    it('should handle malformed JSON from Redis gracefully', async () => {
      const mockClient: RedisClientLike = {
        get: async () => 'invalid-json',
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(mockClient);

      const result = await cache.getAsync('bad-key');

      expect(result).toBeUndefined();
    });

    it('should return undefined when remote store has no value', async () => {
      const mockClient: RedisClientLike = {
        get: async () => null,
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(mockClient);

      const result = await cache.getAsync('missing-key');

      expect(result).toBeUndefined();
    });

    it('should track metrics correctly for async read-through hits', async () => {
      const entry: SqlCacheEntry = { query: 'SELECT 1', parameters: [] };
      const mockClient: RedisClientLike = {
        get: async () => JSON.stringify(entry),
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(mockClient);

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
      const mockClient: RedisClientLike = {
        get: async () => null,
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisSqlCacheAdapter(mockClient);

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
      const cache = new RedisSqlCacheAdapter(client);

      expect(cache.size()).toBe(0);
    });

    it('should accept all custom options', () => {
      const { subscriber, publisher } = createMockPubSub();
      const cache = new RedisSqlCacheAdapter(client, {
        ttlSeconds: 600,
        keyPrefix: 'app:',
        writeThrough: false,
        shadowMaxSize: 5000,
        shadowTtlMs: 30000,
        hashKeys: true,
        pubSubChannel: 'cache-invalidate',
        subscriber,
        publisher
      });

      expect(cache).toBeDefined();
    });
  });
});
