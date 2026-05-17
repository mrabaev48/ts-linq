import { describe, it, expect, beforeEach } from '@jest/globals';
import { LruCache } from '../src/LruCache';
import type { SqlCacheEntry } from '@ts-linq/types';

const entry = (query = 'SELECT 1'): SqlCacheEntry => ({ query, parameters: [] });
const longKey = (prefix: string) => prefix + 'x'.repeat(201 - prefix.length);

describe('LruCache', () => {
  describe('basic get/set', () => {
    let cache: LruCache;

    beforeEach(() => {
      cache = new LruCache({ maxSize: 10 });
    });

    it('returns undefined for a missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('stores and retrieves an entry', () => {
      cache.set('key', entry('SELECT 1'));
      const result = cache.get('key');
      expect(result).toBeDefined();
      expect(result!.query).toBe('SELECT 1');
    });

    it('returns a defensive copy of parameters', () => {
      cache.set('key', { query: 'SELECT 1', parameters: ['a', 'b'] });
      const result = cache.get('key')!;
      expect(result.parameters).toEqual(['a', 'b']);
      // mutating the returned array must not affect the store
      (result.parameters as string[]).push('c');
      expect(cache.get('key')!.parameters).toHaveLength(2);
    });

    it('size() reflects the number of stored entries', () => {
      expect(cache.size()).toBe(0);
      cache.set('a', entry());
      cache.set('b', entry());
      expect(cache.size()).toBe(2);
    });

    it('clear() removes all entries', () => {
      cache.set('a', entry());
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('key compression', () => {
    let cache: LruCache;

    beforeEach(() => {
      cache = new LruCache({ maxSize: 10, enableKeyCompression: true, compressionThreshold: 200 });
    });

    it('uses the original key for short keys', () => {
      cache.set('short', entry());
      expect(cache.get('short')).toBeDefined();
    });

    it('compresses keys longer than the threshold', () => {
      const key = longKey('User|s:');
      cache.set(key, entry('SELECT * FROM users'));
      expect(cache.get(key)).toBeDefined();
    });

    it('consistently maps the same long key to the same compressed key', () => {
      const key = longKey('User|s:');
      cache.set(key, entry('first'));
      cache.set(key, entry('second'));
      // second write overwrites first; only 1 entry stored
      expect(cache.size()).toBe(1);
      expect(cache.get(key)!.query).toBe('second');
    });
  });

  describe('LRU promotion (enableLru: true)', () => {
    it('promotes accessed entry to most-recently-used position', () => {
      const cache = new LruCache({ maxSize: 3, enableLru: true });
      cache.set('a', entry('a'));
      cache.set('b', entry('b'));
      cache.set('c', entry('c'));

      // Access 'a' — it should move to tail
      cache.get('a');

      // Add 'd' — capacity triggers eviction of LRU head ('b')
      cache.set('d', entry('d'));

      expect(cache.get('a')).toBeDefined(); // still present (promoted)
      expect(cache.get('b')).toBeUndefined(); // evicted
      expect(cache.get('c')).toBeDefined();
      expect(cache.get('d')).toBeDefined();
    });
  });

  describe('FIFO mode (enableLru: false)', () => {
    it('evicts the oldest-inserted entry when at capacity', () => {
      const cache = new LruCache({ maxSize: 3, enableLru: false });
      cache.set('a', entry('a'));
      cache.set('b', entry('b'));
      cache.set('c', entry('c'));

      // Accessing 'a' should NOT promote it; it stays as the oldest
      cache.get('a');
      cache.set('d', entry('d'));

      // 'a' was inserted first — it (or 10% batch) should be evicted
      // With maxSize=3 and 10%-or-1, 1 entry evicted = 'a'
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('capacity enforcement', () => {
    it('evicts approximately 10% of entries when at maxSize', () => {
      const maxSize = 10;
      const cache = new LruCache({ maxSize, enableLru: false });

      for (let i = 0; i < maxSize; i++) {
        cache.set(`key${i}`, entry());
      }
      expect(cache.size()).toBe(maxSize);

      // Adding one more triggers eviction of 10% = 1 entry
      cache.set('overflow', entry());
      expect(cache.size()).toBe(maxSize); // still maxSize after evict+insert
    });

    it('evicts at least 1 entry when maxSize is small', () => {
      const cache = new LruCache({ maxSize: 1, enableLru: false });
      cache.set('a', entry('a'));
      cache.set('b', entry('b'));
      // one entry remains
      expect(cache.size()).toBe(1);
    });
  });

  describe('invalidateBy()', () => {
    let cache: LruCache;

    beforeEach(() => {
      cache = new LruCache({ maxSize: 100, enableKeyCompression: true, compressionThreshold: 200 });
    });

    it('removes uncompressed entries matching the predicate', () => {
      cache.set('User|s:', entry());
      cache.set('User|s:|l:10', entry());
      cache.set('Post|s:', entry());

      const removed = cache.invalidateBy((k) => k.startsWith('User|'));
      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('returns 0 when no entries match', () => {
      cache.set('Post|s:', entry());
      expect(cache.invalidateBy((k) => k.startsWith('User|'))).toBe(0);
    });

    it('removes compressed (hash_) entries via keyMap lookup', () => {
      const key = longKey('User|s:');
      cache.set(key, entry());
      const removed = cache.invalidateBy((k) => k.startsWith('User|'));
      expect(removed).toBe(1);
      expect(cache.size()).toBe(0);
      expect(cache.get(key)).toBeUndefined();
    });

    it('removes mixed compressed and uncompressed matching entries', () => {
      const shortKey = 'User|s:';
      const longUserKey = longKey('User|s:|w:name=?(alice)');
      cache.set(shortKey, entry());
      cache.set(longUserKey, entry());
      cache.set('Post|s:', entry());

      const removed = cache.invalidateBy((k) => k.startsWith('User|'));
      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('does not affect entries that do not match', () => {
      cache.set('Post|s:', entry('post'));
      cache.set('Author|s:', entry('author'));
      cache.invalidateBy((k) => k.startsWith('User|'));
      expect(cache.get('Post|s:')).toBeDefined();
      expect(cache.get('Author|s:')).toBeDefined();
    });

    it('can be called on an empty cache', () => {
      expect(() => cache.invalidateBy(() => true)).not.toThrow();
      expect(cache.invalidateBy(() => true)).toBe(0);
    });
  });

  describe('getTopAccessed()', () => {
    it('returns entries sorted descending by accessCount', () => {
      const cache = new LruCache({ maxSize: 100 });
      cache.set('a', entry('a'));
      cache.set('b', entry('b'));
      cache.set('c', entry('c'));

      // access 'c' 3 times, 'a' 2 times, 'b' 1 time (initial set counts as 1)
      cache.get('c'); cache.get('c');
      cache.get('a');

      const top = cache.getTopAccessed(3);
      expect(top[0].key).toBe('c');
      expect(top[1].key).toBe('a');
      expect(top[2].key).toBe('b');
    });

    it('returns empty array for an empty cache', () => {
      const cache = new LruCache({ maxSize: 100 });
      expect(cache.getTopAccessed()).toEqual([]);
    });

    it('limits results to n', () => {
      const cache = new LruCache({ maxSize: 100 });
      for (let i = 0; i < 20; i++) cache.set(`key${i}`, entry());
      expect(cache.getTopAccessed(5)).toHaveLength(5);
    });
  });
});
