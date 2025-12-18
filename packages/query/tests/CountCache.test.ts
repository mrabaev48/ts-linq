import { InMemoryCountCache, CountCacheEntry } from '../src/CountCache';

describe('InMemoryCountCache', () => {
  describe('Constructor', () => {
    it('should create cache with default options', () => {
      const cache = new InMemoryCountCache();
      expect(cache).toBeDefined();
    });

    it('should create cache with custom TTL', () => {
      const cache = new InMemoryCountCache(5000);
      expect(cache).toBeDefined();
    });

    it('should create cache with custom TTL and max size', () => {
      const cache = new InMemoryCountCache(10000, 100);
      expect(cache).toBeDefined();
    });
  });

  describe('get()', () => {
    let cache: InMemoryCountCache;

    beforeEach(() => {
      cache = new InMemoryCountCache(10000, 100);
    });

    it('should return undefined for non-existent key', () => {
      const result = cache.get('missing');
      expect(result).toBeUndefined();
    });

    it('should return cached entry', () => {
      const entry: CountCacheEntry = { value: 42, ts: Date.now() };
      cache.set('test', entry);
      
      const result = cache.get('test');
      expect(result).toEqual(entry);
    });

    it('should return undefined for expired entry', () => {
      const cache = new InMemoryCountCache(100, 100);
      const oldTs = Date.now() - 200;
      cache.set('expired', { value: 10, ts: oldTs });
      
      const result = cache.get('expired');
      expect(result).toBeUndefined();
    });

    it('should return entry within TTL', () => {
      const cache = new InMemoryCountCache(1000, 100);
      const entry: CountCacheEntry = { value: 100, ts: Date.now() };
      cache.set('valid', entry);
      
      const result = cache.get('valid');
      expect(result).toEqual(entry);
    });
  });

  describe('set()', () => {
    it('should add entry to cache', () => {
      const cache = new InMemoryCountCache(10000, 100);
      const entry: CountCacheEntry = { value: 5, ts: Date.now() };
      
      cache.set('key1', entry);
      
      expect(cache.get('key1')).toEqual(entry);
    });

    it('should update existing entry', () => {
      const cache = new InMemoryCountCache(10000, 100);
      const entry1: CountCacheEntry = { value: 1, ts: Date.now() };
      const entry2: CountCacheEntry = { value: 2, ts: Date.now() };
      
      cache.set('key', entry1);
      cache.set('key', entry2);
      
      expect(cache.get('key')).toEqual(entry2);
    });

    it('should evict oldest entry when max size exceeded (FIFO)', () => {
      const cache = new InMemoryCountCache(10000, 3);
      
      cache.set('a', { value: 1, ts: Date.now() });
      cache.set('b', { value: 2, ts: Date.now() });
      cache.set('c', { value: 3, ts: Date.now() });
      cache.set('d', { value: 4, ts: Date.now() });
      
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeDefined();
      expect(cache.get('c')).toBeDefined();
      expect(cache.get('d')).toBeDefined();
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      const cache = new InMemoryCountCache(10000, 100);
      
      cache.set('x', { value: 1, ts: Date.now() });
      cache.set('y', { value: 2, ts: Date.now() });
      
      cache.clear();
      
      expect(cache.get('x')).toBeUndefined();
      expect(cache.get('y')).toBeUndefined();
    });

    it('should not throw on empty cache', () => {
      const cache = new InMemoryCountCache();
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('invalidateBy()', () => {
    let cache: InMemoryCountCache;

    beforeEach(() => {
      cache = new InMemoryCountCache(10000, 100);
      cache.set('user:1', { value: 10, ts: Date.now() });
      cache.set('user:2', { value: 20, ts: Date.now() });
      cache.set('order:1', { value: 5, ts: Date.now() });
      cache.set('order:2', { value: 8, ts: Date.now() });
    });

    it('should invalidate matching keys', () => {
      const removed = cache.invalidateBy(key => key.startsWith('user:'));
      
      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('order:1')).toBeDefined();
      expect(cache.get('order:2')).toBeDefined();
    });

    it('should return 0 when no keys match', () => {
      const removed = cache.invalidateBy(key => key.startsWith('product:'));
      expect(removed).toBe(0);
    });

    it('should invalidate all with always-true matcher', () => {
      const removed = cache.invalidateBy(() => true);
      expect(removed).toBe(4);
    });

    it('should handle complex matchers', () => {
      const removed = cache.invalidateBy(key => key.endsWith(':1'));
      
      expect(removed).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('order:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeDefined();
      expect(cache.get('order:2')).toBeDefined();
    });
  });

  describe('TTL behavior', () => {
    it('should keep entry when TTL is 0 (disabled)', () => {
      const cache = new InMemoryCountCache(0, 100);
      const oldTs = Date.now() - 100000;
      cache.set('forever', { value: 999, ts: oldTs });
      
      const result = cache.get('forever');
      expect(result).toBeDefined();
      expect(result?.value).toBe(999);
    });
  });
});
