import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { SqlCacheEntry } from '@ts-linq/types';

import { EnhancedSqlCache } from '../src/EnhancedSqlCache';

const entry = (query = 'SELECT 1'): SqlCacheEntry => ({ query, parameters: [] });

// Key longer than the 200-char compression threshold
const longKey = (prefix: string) => prefix + 'x'.repeat(201 - prefix.length);

describe('EnhancedSqlCache', () => {
  describe('invalidateBy() — uncompressed keys', () => {
    let cache: EnhancedSqlCache;

    beforeEach(() => {
      cache = new EnhancedSqlCache({ defaultTtl: 0 });
    });

    afterEach(() => {
      cache.dispose();
    });

    it('removes entries matching the prefix', () => {
      cache.set('User|s:|w:', entry('SELECT * FROM users'));
      cache.set('User|s:|l:10', entry('SELECT * FROM users LIMIT 10'));
      cache.set('Post|s:', entry('SELECT * FROM posts'));

      const removed = cache.invalidateBy((k) => k.startsWith('User|'));

      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
      expect(cache.get('Post|s:')).toBeDefined();
    });

    it('returns 0 when nothing matches', () => {
      cache.set('Post|s:', entry());

      expect(cache.invalidateBy((k) => k.startsWith('User|'))).toBe(0);
      expect(cache.size()).toBe(1);
    });

    it('does not touch entries that do not match', () => {
      cache.set('User|s:', entry('u'));
      cache.set('Author|s:', entry('a'));
      cache.set('Post|s:', entry('p'));

      cache.invalidateBy((k) => k.startsWith('User|'));

      expect(cache.get('Author|s:')).toBeDefined();
      expect(cache.get('Post|s:')).toBeDefined();
    });

    it('updates eviction metrics', () => {
      cache.set('User|s:', entry());
      cache.set('User|s:|l:5', entry());
      cache.invalidateBy((k) => k.startsWith('User|'));

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(2);
      expect(metrics.currentSize).toBe(0);
    });

    it('can be called on an empty cache', () => {
      expect(() => cache.invalidateBy(() => true)).not.toThrow();
      expect(cache.invalidateBy(() => true)).toBe(0);
    });
  });

  describe('invalidateBy() — compressed keys (key length > 200 chars)', () => {
    let cache: EnhancedSqlCache;

    beforeEach(() => {
      cache = new EnhancedSqlCache({
        defaultTtl: 0,
        enableKeyCompression: true,
        compressionThreshold: 200
      });
    });

    afterEach(() => {
      cache.dispose();
    });

    it('removes a compressed entry matched via keyMap', () => {
      const key = longKey('User|s:|w:name=?(alice)');
      cache.set(key, entry('SELECT * FROM users WHERE name = ?'));

      const removed = cache.invalidateBy((k) => k.startsWith('User|'));

      expect(removed).toBe(1);
      expect(cache.size()).toBe(0);
    });

    it('cleans up keyMap on removal', () => {
      const key = longKey('User|s:|w:name=?(alice)');
      cache.set(key, entry());
      cache.invalidateBy((k) => k.startsWith('User|'));

      // After invalidation the entry must not be retrievable
      expect(cache.get(key)).toBeUndefined();
    });

    it('does not remove compressed entries that do not match', () => {
      const userKey = longKey('User|s:|w:name=?(alice)');
      const postKey = longKey('Post|s:|w:title=?(hello world)');

      cache.set(userKey, entry('u'));
      cache.set(postKey, entry('p'));

      cache.invalidateBy((k) => k.startsWith('User|'));

      expect(cache.size()).toBe(1);
      expect(cache.get(postKey)).toBeDefined();
    });
  });

  describe('invalidateBy() — mixed compressed and uncompressed keys', () => {
    let cache: EnhancedSqlCache;

    beforeEach(() => {
      cache = new EnhancedSqlCache({ defaultTtl: 0 });
    });

    afterEach(() => {
      cache.dispose();
    });

    it('removes both short and long matching keys in one call', () => {
      const shortKey = 'User|s:';
      const compressedKey = longKey('User|s:|w:very_long_condition');

      cache.set(shortKey, entry('short'));
      cache.set(compressedKey, entry('long'));
      cache.set('Post|s:', entry('unrelated'));

      const removed = cache.invalidateBy((k) => k.startsWith('User|'));

      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
    });
  });

  describe('dispose()', () => {
    it('clears data and does not throw', () => {
      const cache = new EnhancedSqlCache({ defaultTtl: 0 });
      cache.set('User|s:', entry());

      expect(() => cache.dispose()).not.toThrow();
      expect(cache.size()).toBe(0);
    });

    it('is idempotent — calling dispose() twice does not throw', () => {
      const cache = new EnhancedSqlCache({ defaultTtl: 0 });
      cache.dispose();
      expect(() => cache.dispose()).not.toThrow();
    });

    it('clears data after dispose()', () => {
      const cache = new EnhancedSqlCache({ defaultTtl: 0 });
      cache.set('User|s:', entry());
      cache.dispose();

      expect(cache.get('User|s:')).toBeUndefined();
    });
  });

  describe('dispose() — timer lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not start a timer when defaultTtl is 0', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const cache = new EnhancedSqlCache({ defaultTtl: 0 });

      expect(setIntervalSpy).not.toHaveBeenCalled();
      cache.dispose();
      setIntervalSpy.mockRestore();
    });

    it('starts a timer when defaultTtl > 0 and stops it on dispose()', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const cache = new EnhancedSqlCache({ defaultTtl: 60000 });

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      cache.dispose();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it('periodic cleanup expires stale entries', () => {
      // Use a short TTL (100 ms) so the entry is long-expired when the minimum
      // cleanup interval (60 000 ms = Math.max(ttl/4, 60_000)) fires.
      const cache = new EnhancedSqlCache({ defaultTtl: 100 });

      cache.set('User|s:', entry());
      expect(cache.size()).toBe(1);

      // Advance past the minimum cleanup interval (60 s). The setInterval callback
      // calls expireEntries(), which removes entries whose ttl (100 ms) has passed.
      jest.advanceTimersByTime(60001);

      expect(cache.size()).toBe(0);
      cache.dispose();
    });
  });

  describe('metrics', () => {
    let cache: EnhancedSqlCache;

    beforeEach(() => {
      cache = new EnhancedSqlCache({ defaultTtl: 0, enableMetrics: true });
    });

    afterEach(() => {
      cache.dispose();
    });

    it('evictions counter increments on invalidateBy', () => {
      cache.set('User|s:', entry());
      cache.set('User|s:|l:5', entry());

      cache.invalidateBy((k) => k.startsWith('User|'));

      expect(cache.getMetrics().evictions).toBe(2);
    });

    it('evictions counter does not change when invalidateBy matches nothing', () => {
      cache.set('Post|s:', entry());

      cache.invalidateBy((k) => k.startsWith('User|'));

      expect(cache.getMetrics().evictions).toBe(0);
    });

    it('metrics reset after clear()', () => {
      cache.set('User|s:', entry());
      cache.invalidateBy((k) => k.startsWith('User|'));

      cache.clear();

      const m = cache.getMetrics();
      expect(m.evictions).toBe(0);
      expect(m.currentSize).toBe(0);
    });
  });

  describe('TTL expiration', () => {
    it('get() returns undefined for expired entries', () => {
      jest.useFakeTimers();
      const cache = new EnhancedSqlCache({ defaultTtl: 5000 });

      cache.set('User|s:', entry());
      jest.advanceTimersByTime(6000);

      expect(cache.get('User|s:')).toBeUndefined();

      cache.dispose();
      jest.useRealTimers();
    });
  });
});
