import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryCountCache, type CountCacheEntry } from '../src/CountCache';

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
      const entry: CountCacheEntry = { value: 42, ts: Date.now() };
      cache.set('key1', entry);
      expect(cache.get('key1')?.value).toBe(42);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', { value: 10, ts: Date.now() });
      cache.set('key1', { value: 20, ts: Date.now() });
      expect(cache.get('key1')?.value).toBe(20);
    });

    it('should store zero values', () => {
      cache.set('empty', { value: 0, ts: Date.now() });
      expect(cache.get('empty')?.value).toBe(0);
    });

    it('should handle multiple keys', () => {
      cache.set('a', { value: 1, ts: Date.now() });
      cache.set('b', { value: 2, ts: Date.now() });
      cache.set('c', { value: 3, ts: Date.now() });

      expect(cache.get('a')?.value).toBe(1);
      expect(cache.get('b')?.value).toBe(2);
      expect(cache.get('c')?.value).toBe(3);
    });
  });

  describe('get() with TTL', () => {
    it('should return entry within TTL', () => {
      cache.set('key1', { value: 100, ts: Date.now() });
      expect(cache.get('key1')).toBeDefined();
    });

    it('should return undefined for expired entries', () => {
      const expiredTs = Date.now() - 15000; // 15s ago (ttl is 10s)
      cache.set('expired', { value: 99, ts: expiredTs });
      expect(cache.get('expired')).toBeUndefined();
    });

    it('should not expire with ttl=0', () => {
      const noTtlCache = new InMemoryCountCache(0, 100);
      const oldTs = Date.now() - 999999;
      noTtlCache.set('key', { value: 1, ts: oldTs });
      expect(noTtlCache.get('key')).toBeDefined();
    });
  });

  describe('invalidateBy()', () => {
    it('should remove matching entries', () => {
      cache.set('user:1', { value: 10, ts: Date.now() });
      cache.set('user:2', { value: 20, ts: Date.now() });
      cache.set('post:1', { value: 5, ts: Date.now() });

      const removed = cache.invalidateBy((key) => key.startsWith('user:'));

      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('post:1')).toBeDefined();
    });

    it('should return 0 when no matches', () => {
      cache.set('a', { value: 1, ts: Date.now() });
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
      cache.set('a', { value: 1, ts: Date.now() });
      cache.set('b', { value: 2, ts: Date.now() });
      cache.set('c', { value: 3, ts: Date.now() });

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

      smallCache.set('a', { value: 1, ts: Date.now() });
      smallCache.set('b', { value: 2, ts: Date.now() });
      smallCache.set('c', { value: 3, ts: Date.now() });

      smallCache.set('d', { value: 4, ts: Date.now() });
      expect(smallCache.get('a')).toBeUndefined();
      expect(smallCache.get('d')).toBeDefined();
    });

    it('should maintain FIFO eviction order', () => {
      const smallCache = new InMemoryCountCache(10000, 2);

      smallCache.set('first', { value: 1, ts: Date.now() });
      smallCache.set('second', { value: 2, ts: Date.now() });
      smallCache.set('third', { value: 3, ts: Date.now() });

      expect(smallCache.get('first')).toBeUndefined();
      expect(smallCache.get('second')).toBeDefined();
      expect(smallCache.get('third')).toBeDefined();
    });

    it('should handle continuous eviction', () => {
      const smallCache = new InMemoryCountCache(10000, 2);

      for (let i = 0; i < 10; i++) {
        smallCache.set(`key${i}`, { value: i, ts: Date.now() });
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

      tinyCache.set('a', { value: 1, ts: Date.now() });
      expect(tinyCache.get('a')?.value).toBe(1);

      tinyCache.set('b', { value: 2, ts: Date.now() });
      expect(tinyCache.get('b')?.value).toBe(2);
      expect(tinyCache.get('a')).toBeUndefined();
    });

    it('should handle negative count values', () => {
      cache.set('negative', { value: -5, ts: Date.now() });
      expect(cache.get('negative')?.value).toBe(-5);
    });

    it('should handle very large count values', () => {
      const large = Number.MAX_SAFE_INTEGER;
      cache.set('large', { value: large, ts: Date.now() });
      expect(cache.get('large')?.value).toBe(large);
    });

    it('should handle empty string keys', () => {
      cache.set('', { value: 999, ts: Date.now() });
      expect(cache.get('')?.value).toBe(999);
    });

    it('should handle special character keys', () => {
      const key = 'key with spaces and !@#$%';
      cache.set(key, { value: 123, ts: Date.now() });
      expect(cache.get(key)?.value).toBe(123);
    });

    it('should be case-sensitive with keys', () => {
      cache.set('Key', { value: 1, ts: Date.now() });
      cache.set('key', { value: 2, ts: Date.now() });

      expect(cache.get('Key')?.value).toBe(1);
      expect(cache.get('key')?.value).toBe(2);
    });
  });

  describe('key generation scenarios', () => {
    it('should handle query-like keys', () => {
      const queryKey = 'User|w:id=?|o:name:ASC|l:10';
      cache.set(queryKey, { value: 42, ts: Date.now() });
      expect(cache.get(queryKey)?.value).toBe(42);
    });

    it('should differentiate similar keys', () => {
      cache.set('User|limit:10', { value: 100, ts: Date.now() });
      cache.set('User|limit:20', { value: 200, ts: Date.now() });

      expect(cache.get('User|limit:10')?.value).toBe(100);
      expect(cache.get('User|limit:20')?.value).toBe(200);
    });

    it('should handle long composite keys', () => {
      const longKey = 'Entity|select:a,b,c|where:x=1 AND y=2|order:z DESC|limit:100|offset:0';
      cache.set(longKey, { value: 999, ts: Date.now() });
      expect(cache.get(longKey)?.value).toBe(999);
    });
  });

  describe('performance characteristics', () => {
    it('should handle many sequential operations', () => {
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        cache.set(`key${i}`, { value: i, ts: Date.now() });
      }

      // Only last 100 should be retained (max size)
      expect(cache.get('key999')).toBeDefined();
      expect(cache.get('key0')).toBeUndefined();
    });
  });
});
