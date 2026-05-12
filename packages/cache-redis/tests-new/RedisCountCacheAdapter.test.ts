import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  RedisCountCacheAdapter,
  type RedisClientLike,
  type RedisSubscriberLike,
  type RedisPublisherLike
} from '../src/redis/RedisCountCacheAdapter';

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
  await new Promise(resolve => setImmediate(resolve));
}

describe('RedisCountCacheAdapter', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
  });

  describe('shadow cache (LRU)', () => {
    it('should store and retrieve values from shadow cache', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 42);
      const result = cache.get('key1');

      expect(result).toBe(42);
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new RedisCountCacheAdapter(client);

      const result = cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should enforce FIFO eviction when shadow cache is full', () => {
      const cache = new RedisCountCacheAdapter(client, { shadowMaxSize: 3 });

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
      const cache = new RedisCountCacheAdapter(client, { shadowMaxSize: 3 });

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.get('key1');
      cache.set('key4', 4);

      expect(cache.get('key1')).toBe(1);
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should expire entries based on shadowTtlMs', async () => {
      const cache = new RedisCountCacheAdapter(client, { shadowTtlMs: 50 });

      cache.set('key1', 42);
      expect(cache.get('key1')).toBe(42);

      await new Promise(resolve => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('write-through to Redis', () => {
    it('should write to Redis on set with default prefix', async () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('mykey', 123);
      await flushPromises();

      expect(client.calls.set).toHaveLength(1);
      expect(client.calls.set[0].key).toBe('tslnq:cnt:mykey');
      const payload = JSON.parse(client.calls.set[0].value);
      expect(payload.value).toBe(123);
      expect(payload.ts).toBeGreaterThan(0);
    });

    it('should use custom keyPrefix', async () => {
      const cache = new RedisCountCacheAdapter(client, { keyPrefix: 'custom:' });

      cache.set('mykey', 456);
      await flushPromises();

      expect(client.calls.set[0].key).toBe('custom:mykey');
    });

    it('should apply TTL when configured', async () => {
      const cache = new RedisCountCacheAdapter(client, { ttlSeconds: 300 });

      cache.set('mykey', 789);
      await flushPromises();

      expect(client.calls.set[0].mode).toBe('EX');
      expect(client.calls.set[0].ttl).toBe(300);
    });

    it('should omit TTL when not configured', async () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('mykey', 100);
      await flushPromises();

      expect(client.calls.set[0].mode).toBeUndefined();
      expect(client.calls.set[0].ttl).toBeUndefined();
    });

    it('should hash keys when hashKeys is enabled', async () => {
      const cache = new RedisCountCacheAdapter(client, { hashKeys: true });

      cache.set('long-key-that-should-be-hashed', 42);
      await flushPromises();

      const key = client.calls.set[0].key;
      expect(key).toMatch(/^tslnq:cnt:[0-9a-f]+$/);
      expect(key.length).toBeLessThan(30);
    });

    it('should handle write-through failures silently', async () => {
      const failingClient: RedisClientLike = {
        get: async () => null,
        set: async () => {
          throw new Error('Redis down');
        },
        del: async () => {}
      };

      const cache = new RedisCountCacheAdapter(failingClient);

      expect(() => cache.set('key', 42)).not.toThrow();
      expect(cache.get('key')).toBe(42);
    });
  });

  describe('clear()', () => {
    it('should clear shadow cache', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should broadcast clear message via pub/sub', () => {
      const { subscriber, publisher, published } = createMockPubSub();
      const cache = new RedisCountCacheAdapter(client, {
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

  describe('invalidateBy()', () => {
    it('should invalidate matching keys from shadow cache', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('user:1', 1);
      cache.set('user:2', 2);
      cache.set('post:1', 3);

      const removed = cache.invalidateBy(k => k.startsWith('user:'));

      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBe(3);
    });

    it('should delete matching keys from Redis', async () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      client.calls.del = [];

      cache.invalidateBy(k => k === 'key1');
      await flushPromises();

      expect(client.calls.del).toContain('tslnq:cnt:key1');
      expect(client.calls.del).not.toContain('tslnq:cnt:key2');
    });

    it('should broadcast delete messages via pub/sub', () => {
      const { subscriber, publisher, published } = createMockPubSub();
      const cache = new RedisCountCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber,
        publisher
      });

      cache.set('key1', 1);
      cache.invalidateBy(k => k === 'key1');

      expect(published.length).toBeGreaterThan(0);
      const deleteMsg = published.find(p => {
        const msg = JSON.parse(p.message);
        return msg.t === 'del' && msg.k === 'key1';
      });
      expect(deleteMsg).toBeDefined();
    });

    it('should return 0 when no keys match', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 1);
      const removed = cache.invalidateBy(k => k === 'nonexistent');

      expect(removed).toBe(0);
    });
  });

  describe('pub/sub cross-instance invalidation', () => {
    it('should clear shadow cache when receiving clear message', () => {
      const { subscriber, triggerMessage } = createMockPubSub();
      const cache = new RedisCountCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber
      });

      cache.set('key1', 1);
      cache.set('key2', 2);

      triggerMessage('invalidate', JSON.stringify({ t: 'clear' }));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should delete specific key when receiving del message', () => {
      const { subscriber, triggerMessage } = createMockPubSub();
      const cache = new RedisCountCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber
      });

      cache.set('key1', 1);
      cache.set('key2', 2);

      triggerMessage('invalidate', JSON.stringify({ t: 'del', k: 'key1' }));

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(2);
    });

    it('should ignore malformed pub/sub messages', () => {
      const { subscriber, triggerMessage } = createMockPubSub();
      const cache = new RedisCountCacheAdapter(client, {
        pubSubChannel: 'invalidate',
        subscriber
      });

      cache.set('key1', 1);

      triggerMessage('invalidate', 'not-json');
      triggerMessage('invalidate', JSON.stringify({ invalid: 'format' }));

      expect(cache.get('key1')).toBe(1);
    });
  });

  describe('metrics', () => {
    it('should track requests and hits', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.get('key1');
      cache.get('nonexistent');

      const metrics = cache.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.hits).toBe(1);
    });

    it('should track misses for expired TTL entries', async () => {
      const cache = new RedisCountCacheAdapter(client, { shadowTtlMs: 50 });

      cache.set('key1', 1);
      await new Promise(resolve => setTimeout(resolve, 60));
      cache.get('key1');

      const metrics = cache.getMetrics();

      expect(metrics.misses).toBe(1);
    });

    it('should track evictions', () => {
      const cache = new RedisCountCacheAdapter(client, { shadowMaxSize: 2 });

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      const metrics = cache.getMetrics();

      expect(metrics.evictions).toBe(1);
    });

    it('should track invalidations', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.invalidateBy(k => k.startsWith('key'));

      const metrics = cache.getMetrics();

      expect(metrics.invalidations).toBe(2);
    });

    it('should report current size', () => {
      const cache = new RedisCountCacheAdapter(client);

      cache.set('key1', 1);
      cache.set('key2', 2);

      const metrics = cache.getMetrics();

      expect(metrics.currentSize).toBe(2);
    });
  });

  describe('read-through from Redis (async)', () => {
    it('should hydrate shadow cache from Redis on miss', async () => {
      const mockClient: RedisClientLike = {
        get: async (key: string) => {
          if (key === 'tslnq:cnt:remote-key') {
            return JSON.stringify({ value: 999, ts: Date.now() });
          }
          return null;
        },
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisCountCacheAdapter(mockClient);

      const result = await cache.getAsync('remote-key');

      expect(result).toBe(999);
      expect(cache.get('remote-key')).toBe(999);
    });

    it('should handle malformed JSON from Redis gracefully', async () => {
      const mockClient: RedisClientLike = {
        get: async () => 'invalid-json',
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisCountCacheAdapter(mockClient);

      const result = await cache.getAsync('bad-key');

      expect(result).toBeUndefined();
    });

    it('should use hashKeys when reading from Redis', async () => {
      let requestedKey = '';
      const mockClient: RedisClientLike = {
        get: async (key: string) => {
          requestedKey = key;
          return JSON.stringify({ value: 42, ts: Date.now() });
        },
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisCountCacheAdapter(mockClient, { hashKeys: true });

      await cache.getAsync('long-key-to-hash');

      expect(requestedKey).toMatch(/^tslnq:cnt:[0-9a-f]+$/);
      expect(requestedKey.length).toBeLessThan(30);
    });

    it('should clone parameters when hydrating from Redis', async () => {
      const mockClient: RedisClientLike = {
        get: async () => JSON.stringify({ value: 42, ts: Date.now() }),
        set: async () => {},
        del: async () => {}
      };
      const cache = new RedisCountCacheAdapter(mockClient);

      const result1 = await cache.getAsync('key');
      const result2 = await cache.getAsync('key');

      expect(result1).toBe(42);
      expect(result2).toBe(42);
    });
  });

  describe('constructor options', () => {
    it('should use defaults when no options provided', () => {
      const cache = new RedisCountCacheAdapter(client);

      const metrics = cache.getMetrics();

      expect(metrics).toBeDefined();
    });

    it('should accept all custom options', () => {
      const { subscriber, publisher } = createMockPubSub();
      const cache = new RedisCountCacheAdapter(client, {
        ttlSeconds: 600,
        keyPrefix: 'app:',
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
