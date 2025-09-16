import { 
  EnhancedSqlCache, 
  type EnhancedSqlCacheOptions 
} from './EnhancedSqlCache';
import type { SqlCacheEntry } from './SqlCache';

describe('EnhancedSqlCache', () => {
  let cache: EnhancedSqlCache;
  const testEntry: SqlCacheEntry = {
    query: 'SELECT * FROM users WHERE id = ?',
    parameters: [1]
  };

  beforeEach(() => {
    cache = new EnhancedSqlCache();
  });

  afterEach(() => {
    cache.dispose(); // Clean up resources and clear cache
  });

  describe('Basic Operations', () => {
    test('should store and retrieve entries', () => {
      const key = 'test_key';
      cache.set(key, testEntry);
      
      const retrieved = cache.get(key);
      expect(retrieved).toBeDefined();
      expect(retrieved?.query).toBe(testEntry.query);
      expect(retrieved?.parameters).toEqual(testEntry.parameters);
      expect(cache.size()).toBe(1);
    });

    test('should return undefined for non-existent keys', () => {
      const retrieved = cache.get('non_existent');
      expect(retrieved).toBeUndefined();
    });

    test('should clear all entries', () => {
      cache.set('key1', testEntry);
      cache.set('key2', testEntry);
      expect(cache.size()).toBe(2);
      
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('TTL (Time To Live)', () => {
    test('should expire entries after TTL', async () => {
      const options: EnhancedSqlCacheOptions = {
        defaultTtl: 100, // 100ms TTL
        enableMetrics: true
      };
      cache = new EnhancedSqlCache(options);
      
      cache.set('expiring_key', testEntry);
      expect(cache.get('expiring_key')).toBeDefined();
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get('expiring_key')).toBeUndefined();
      
      const metrics = cache.getMetrics();
      expect(metrics.expirations).toBe(1);
      expect(metrics.misses).toBe(1);
    });

    test('should support custom TTL per entry', async () => {
      cache.set('short_ttl', testEntry, 50); // 50ms TTL
      cache.set('long_ttl', testEntry, 200); // 200ms TTL
      
      await new Promise(resolve => setTimeout(resolve, 75));
      
      expect(cache.get('short_ttl')).toBeUndefined();
      expect(cache.get('long_ttl')).toBeDefined();
    });

    test('should not expire entries with TTL = 0', async () => {
      cache.set('no_expiry', testEntry, 0);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('no_expiry')).toBeDefined();
    });

    test('should manually expire entries', async () => {
      const options: EnhancedSqlCacheOptions = {
        defaultTtl: 50,
        enableMetrics: true
      };
      cache = new EnhancedSqlCache(options);
      
      cache.set('key1', testEntry);
      cache.set('key2', testEntry);
      
      // Wait for expiration time
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const expiredCount = cache.expireEntries();
      expect(expiredCount).toBe(2);
      expect(cache.size()).toBe(0);
    });
  });

  describe('LRU Eviction', () => {
    test('should evict least recently used entries when capacity exceeded', () => {
      const options: EnhancedSqlCacheOptions = {
        maxSize: 3,
        enableLru: true,
        enableMetrics: true
      };
      cache = new EnhancedSqlCache(options);

      // Fill cache to capacity
      cache.set('key1', testEntry);
      cache.set('key2', testEntry);
      cache.set('key3', testEntry);
      expect(cache.size()).toBe(3);

      // Access key1 to make it more recently used
      cache.get('key1');
      
      // Add another entry - should evict key2 (least recently used)
      cache.set('key4', testEntry);
      expect(cache.size()).toBe(3);
      
      expect(cache.get('key1')).toBeDefined(); // Still exists (was accessed)
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBeDefined(); // Still exists
      expect(cache.get('key4')).toBeDefined(); // Newly added

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });

    test('should support FIFO eviction when LRU is disabled', () => {
      const options: EnhancedSqlCacheOptions = {
        maxSize: 2,
        enableLru: false,
        enableMetrics: true
      };
      cache = new EnhancedSqlCache(options);

      cache.set('key1', testEntry);
      cache.set('key2', testEntry);
      
      // Access key1 (in LRU this would make it safe from eviction)
      cache.get('key1');
      
      // Add key3 - should evict key1 (first in, first out)
      cache.set('key3', testEntry);
      
      expect(cache.get('key1')).toBeUndefined(); // Evicted (FIFO)
      expect(cache.get('key2')).toBeDefined();
      expect(cache.get('key3')).toBeDefined();
    });
  });

  describe('Key Compression', () => {
    test('should compress long keys', () => {
      const options: EnhancedSqlCacheOptions = {
        enableKeyCompression: true,
        compressionThreshold: 50
      };
      cache = new EnhancedSqlCache(options);

      const longKey = 'a'.repeat(100); // 100 character key
      const shortKey = 'short_key';

      cache.set(longKey, testEntry);
      cache.set(shortKey, testEntry);

      // Both should be retrievable
      expect(cache.get(longKey)).toBeDefined();
      expect(cache.get(shortKey)).toBeDefined();
    });

    test('should not compress keys below threshold', () => {
      const options: EnhancedSqlCacheOptions = {
        enableKeyCompression: true,
        compressionThreshold: 100
      };
      cache = new EnhancedSqlCache(options);

      const mediumKey = 'a'.repeat(50); // Below threshold
      cache.set(mediumKey, testEntry);
      
      expect(cache.get(mediumKey)).toBeDefined();
    });
  });

  describe('Metrics and Performance Tracking', () => {
    beforeEach(() => {
      const options: EnhancedSqlCacheOptions = {
        enableMetrics: true,
        maxSize: 100
      };
      cache = new EnhancedSqlCache(options);
    });

    test('should track hit and miss ratios', () => {
      cache.set('key1', testEntry);
      
      // Generate hits and misses
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const metrics = cache.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRatio).toBeCloseTo(2/3, 2);
    });

    test('should track access counts', () => {
      cache.set('popular_key', testEntry);
      
      // Access multiple times (excluding the initial set() access)
      for (let i = 0; i < 5; i++) {
        cache.get('popular_key');
      }
      
      const metrics = cache.getMetrics();
      expect(metrics.averageAccessCount).toBe(6); // 1 from set() + 5 from get() calls
    });

    test('should estimate memory usage', () => {
      const largeEntry: SqlCacheEntry = {
        query: 'SELECT * FROM large_table WHERE condition = ?'.repeat(10),
        parameters: Array(20).fill('test')
      };
      
      cache.set('large_entry', largeEntry);
      
      const metrics = cache.getMetrics();
      expect(metrics.estimatedMemoryUsage).toBeGreaterThan(0);
      expect(metrics.currentSize).toBe(1);
    });

    test('should track evictions and expirations', async () => {
      const options: EnhancedSqlCacheOptions = {
        maxSize: 2,
        defaultTtl: 50,
        enableMetrics: true
      };
      cache = new EnhancedSqlCache(options);

      // Test evictions
      cache.set('key1', testEntry);
      cache.set('key2', testEntry);
      cache.set('key3', testEntry); // Should cause eviction

      // Test expirations
      await new Promise(resolve => setTimeout(resolve, 60));
      cache.get('key2'); // Should be expired

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
      expect(metrics.expirations).toBeGreaterThan(0);
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache with multiple entries', () => {
      const warmingEntries = [
        { key: 'warm1', value: testEntry },
        { key: 'warm2', value: testEntry },
        { key: 'warm3', value: testEntry, ttl: 1000 }
      ];

      cache.warm(warmingEntries);

      expect(cache.size()).toBe(3);
      expect(cache.get('warm1')).toBeDefined();
      expect(cache.get('warm2')).toBeDefined();
      expect(cache.get('warm3')).toBeDefined();
    });

    test('should handle large warming batches', () => {
      const options: EnhancedSqlCacheOptions = {
        warmingBatchSize: 10
      };
      cache = new EnhancedSqlCache(options);

      const warmingEntries = Array.from({ length: 50 }, (_, i) => ({
        key: `warm_${i}`,
        value: testEntry
      }));

      cache.warm(warmingEntries);

      expect(cache.size()).toBe(50);
      expect(cache.get('warm_0')).toBeDefined();
      expect(cache.get('warm_49')).toBeDefined();
    });
  });

  describe('Optimization Insights', () => {
    beforeEach(() => {
      const options: EnhancedSqlCacheOptions = {
        enableMetrics: true,
        maxSize: 10
      };
      cache = new EnhancedSqlCache(options);
    });

    test('should provide optimization recommendations', () => {
      // Create scenario with low hit ratio
      cache.set('key1', testEntry);
      
      // Generate more misses than hits
      cache.get('nonexistent1');
      cache.get('nonexistent2');
      cache.get('nonexistent3');
      cache.get('key1'); // Single hit

      const insights = cache.getOptimizationInsights();
      
      expect(insights.shouldIncreaseSize).toBeDefined();
      expect(insights.shouldDecreaseTtl).toBeDefined();
      expect(insights.shouldIncreaseTtl).toBeDefined();
      expect(insights.topAccessedEntries).toBeDefined();
      expect(Array.isArray(insights.topAccessedEntries)).toBe(true);
    });

    test('should identify top accessed entries', () => {
      cache.set('popular', testEntry);
      cache.set('unpopular', testEntry);
      
      // Make 'popular' accessed more frequently
      for (let i = 0; i < 10; i++) {
        cache.get('popular');
      }
      cache.get('unpopular');

      const insights = cache.getOptimizationInsights();
      const topEntries = insights.topAccessedEntries;
      
      expect(topEntries.length).toBeGreaterThan(0);
      expect(topEntries[0].accessCount).toBe(11); // 1 from set() + 10 from get() calls
      expect(topEntries[1]?.accessCount).toBe(2); // 1 from set() + 1 from get() call
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty cache operations', () => {
      expect(cache.size()).toBe(0);
      expect(cache.get('anything')).toBeUndefined();
      
      const metrics = cache.getMetrics();
      expect(metrics.currentSize).toBe(0);
      expect(metrics.totalRequests).toBe(1); // From the get call
    });

    test('should handle duplicate key updates', () => {
      const entry1 = { ...testEntry, query: 'SELECT 1' };
      const entry2 = { ...testEntry, query: 'SELECT 2' };

      cache.set('duplicate', entry1);
      expect(cache.get('duplicate')?.query).toBe('SELECT 1');
      
      cache.set('duplicate', entry2);
      expect(cache.get('duplicate')?.query).toBe('SELECT 2');
      expect(cache.size()).toBe(1); // Still only one entry
    });

    test('should handle very large entries', () => {
      const hugeEntry: SqlCacheEntry = {
        query: 'SELECT '.repeat(10000) + '1',
        parameters: Array(1000).fill('huge')
      };

      cache.set('huge', hugeEntry);
      const retrieved = cache.get('huge');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.parameters.length).toBe(1000);
    });

    test('should handle zero and negative TTL values', async () => {
      cache.set('zero_ttl', testEntry, 0);
      cache.set('negative_ttl', testEntry, -100);

      // Both should not expire after time passes
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(cache.get('zero_ttl')).toBeDefined();
      expect(cache.get('negative_ttl')).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    test('should dispose resources properly', () => {
      const options: EnhancedSqlCacheOptions = {
        defaultTtl: 1000, // Enable periodic cleanup
        enableMetrics: true
      };
      const testCache = new EnhancedSqlCache(options);
      
      testCache.set('test', testEntry);
      expect(testCache.size()).toBe(1);
      
      // Dispose should clear cache and cleanup intervals
      testCache.dispose();
      expect(testCache.size()).toBe(0);
      
      // Should be safe to dispose multiple times
      testCache.dispose();
      expect(testCache.size()).toBe(0);
    });

    test('should handle dispose on cache without periodic cleanup', () => {
      const options: EnhancedSqlCacheOptions = {
        defaultTtl: 0, // No periodic cleanup
      };
      const testCache = new EnhancedSqlCache(options);
      
      testCache.set('test', testEntry);
      expect(testCache.size()).toBe(1);
      
      // Should still work even when no interval was created
      testCache.dispose();
      expect(testCache.size()).toBe(0);
    });
  });

  describe('Configuration Options', () => {
    test('should respect all configuration options', () => {
      const options: EnhancedSqlCacheOptions = {
        maxSize: 5,
        defaultTtl: 1000,
        enableLru: false,
        enableKeyCompression: false,
        compressionThreshold: 150,
        enableMetrics: false,
        warmingBatchSize: 25
      };

      cache = new EnhancedSqlCache(options);

      // Verify options are applied
      expect(cache).toBeDefined();
      
      // Fill beyond max size to test capacity
      for (let i = 0; i < 7; i++) {
        cache.set(`key_${i}`, testEntry);
      }
      
      expect(cache.size()).toBeLessThanOrEqual(5);
    });

    test('should use default options when none provided', () => {
      cache = new EnhancedSqlCache();
      
      // Should work with defaults
      cache.set('default_test', testEntry);
      expect(cache.get('default_test')).toBeDefined();
    });
  });
});