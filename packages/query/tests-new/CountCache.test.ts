import { beforeEach, describe, expect, it } from '@jest/globals';

import { InMemoryCountCache } from '../src/CountCache';

describe('InMemoryCountCache', () => {
  let cache: InMemoryCountCache;

  beforeEach(() => {
    cache = new InMemoryCountCache(10000, 100);
  });

  describe('constructor', () => {
    it('should create cache with specified ttl and size', () => {
      const c = new InMemoryCountCache(5000, 50);
      expect(c).toBeDefined();
    });

    it('should create cache with default parameters', () => {
      const c = new InMemoryCountCache();
      expect(c).toBeDefined();
    });
  });

  describe('set() and get()', () => {
    it('should store and retrieve count values', () => {
      cache.set('key1', 42);
      expect(cache.get('key1')).toBe(42);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 10);
      cache.set('key1', 20);
      expect(cache.get('key1')).toBe(20);
    });

    it('should store zero values', () => {
      cache.set('empty', 0);
      expect(cache.get('empty')).toBe(0);
    });

    it('should handle multiple keys', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });
  });

  describe('get() with TTL', () => {
    it('should return entry within TTL', () => {
      cache.set('key1', 100);
      expect(cache.get('key1')).toBeDefined();
    });

    it('should return undefined for expired entries', async () => {
      const tinyTtlCache = new InMemoryCountCache(1, 100); // 1ms TTL
      tinyTtlCache.set('expired', 99);
      await new Promise((r) => setTimeout(r, 10)); // wait > 1ms TTL
      expect(tinyTtlCache.get('expired')).toBeUndefined();
    });

    it('should not expire with ttl=0', () => {
      const noTtlCache = new InMemoryCountCache(0, 100);
      noTtlCache.set('key', 1);
      expect(noTtlCache.get('key')).toBeDefined();
    });
  });

  describe('invalidateBy()', () => {
    it('should remove matching entries', () => {
      cache.set('user:1', 10);
      cache.set('user:2', 20);
      cache.set('post:1', 5);

      const removed = cache.invalidateBy((key) => key.startsWith('user:'));

      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBeDefined();
    });

    it('should return 0 when no matches', () => {
      cache.set('a', 1);
      const removed = cache.invalidateBy((key) => key.startsWith('z'));
      expect(removed).toBe(0);
    });

    it('should handle empty cache', () => {
      const removed = cache.invalidateBy(() => true);
      expect(removed).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBeUndefined();
    });

    it('should work on empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('eviction', () => {
    it('should evict oldest entry when exceeding max size', () => {
      const smallCache = new InMemoryCountCache(10000, 3);

      smallCache.set('a', 1);
      smallCache.set('b', 2);
      smallCache.set('c', 3);

      smallCache.set('d', 4);
      expect(smallCache.get('a')).toBeUndefined();
      expect(smallCache.get('d')).toBeDefined();
    });

    it('should maintain FIFO eviction order', () => {
      const smallCache = new InMemoryCountCache(10000, 2);

      smallCache.set('first', 1);
      smallCache.set('second', 2);
      smallCache.set('third', 3);

      expect(smallCache.get('first')).toBeUndefined();
      expect(smallCache.get('second')).toBeDefined();
      expect(smallCache.get('third')).toBeDefined();
    });

    it('should handle continuous eviction', () => {
      const smallCache = new InMemoryCountCache(10000, 2);

      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, i);
      }

      expect(smallCache.get('key8')).toBeDefined();
      expect(smallCache.get('key9')).toBeDefined();
      expect(smallCache.get('key0')).toBeUndefined();
      expect(smallCache.get('key7')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle size 1 cache', () => {
      const tinyCache = new InMemoryCountCache(10000, 1);

      tinyCache.set('a', 1);
      expect(tinyCache.get('a')).toBe(1);

      tinyCache.set('b', 2);
      expect(tinyCache.get('b')).toBe(2);
      expect(tinyCache.get('a')).toBeUndefined();
    });

    it('should handle negative count values', () => {
      cache.set('negative', -5);
      expect(cache.get('negative')).toBe(-5);
    });

    it('should handle very large count values', () => {
      const large = Number.MAX_SAFE_INTEGER;
      cache.set('large', large);
      expect(cache.get('large')).toBe(large);
    });

    it('should handle empty string keys', () => {
      cache.set('', 999);
      expect(cache.get('')).toBe(999);
    });

    it('should handle special character keys', () => {
      const key = 'key with spaces and !@#$%';
      cache.set(key, 123);
      expect(cache.get(key)).toBe(123);
    });

    it('should be case-sensitive with keys', () => {
      cache.set('Key', 1);
      cache.set('key', 2);

      expect(cache.get('Key')).toBe(1);
      expect(cache.get('key')).toBe(2);
    });
  });

  describe('key generation scenarios', () => {
    it('should handle query-like keys', () => {
      const queryKey = 'User|w:id=?|o:name:ASC|l:10';
      cache.set(queryKey, 42);
      expect(cache.get(queryKey)).toBe(42);
    });

    it('should differentiate similar keys', () => {
      cache.set('User|limit:10', 100);
      cache.set('User|limit:20', 200);

      expect(cache.get('User|limit:10')).toBe(100);
      expect(cache.get('User|limit:20')).toBe(200);
    });

    it('should handle long composite keys', () => {
      const longKey = 'Entity|select:a,b,c|where:x=1 AND y=2|order:z DESC|limit:100|offset:0';
      cache.set(longKey, 999);
      expect(cache.get(longKey)).toBe(999);
    });
  });

  describe('performance characteristics', () => {
    it('should handle many sequential operations', () => {
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        cache.set(`key${i}`, i);
      }

      // Only last 100 should be retained (max size)
      expect(cache.get('key999')).toBeDefined();
      expect(cache.get('key0')).toBeUndefined();
    });
  });
});
