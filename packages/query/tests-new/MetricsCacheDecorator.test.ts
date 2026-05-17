import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetricsCacheDecorator } from '../src/MetricsCacheDecorator';
import { LruCache } from '../src/LruCache';
import type { SqlCacheEntry } from '@ts-linq/types';

const entry = (query = 'SELECT 1'): SqlCacheEntry => ({ query, parameters: [] });

function makeDecorator(maxSize = 100): MetricsCacheDecorator {
  const inner = new LruCache({ maxSize });
  return new MetricsCacheDecorator(inner);
}

describe('MetricsCacheDecorator', () => {
  describe('hit tracking', () => {
    let m: MetricsCacheDecorator;

    beforeEach(() => {
      m = makeDecorator();
      m.set('key', entry());
    });

    it('increments hits on a cache hit', () => {
      m.get('key');
      expect(m.getMetrics().hits).toBe(1);
    });

    it('increments misses on a cache miss', () => {
      m.get('missing');
      expect(m.getMetrics().misses).toBe(1);
    });

    it('increments totalRequests on every get()', () => {
      m.get('key');
      m.get('missing');
      expect(m.getMetrics().totalRequests).toBe(2);
    });

    it('computes hitRatio correctly', () => {
      m.get('key');    // hit
      m.get('key');    // hit
      m.get('missing'); // miss
      const { hitRatio } = m.getMetrics();
      expect(hitRatio).toBeCloseTo(2 / 3, 5);
    });

    it('hitRatio is 0 when no requests have been made', () => {
      expect(m.getMetrics().hitRatio).toBe(0);
    });
  });

  describe('eviction tracking via set()', () => {
    it('records an eviction when inner LRU evicts entries on insert', () => {
      const inner = new LruCache({ maxSize: 3 });
      const m = new MetricsCacheDecorator(inner);

      m.set('a', entry());
      m.set('b', entry());
      m.set('c', entry());
      // Cache is full; next insert evicts 1 entry (10% of 3, rounded up = 1)
      m.set('d', entry());

      expect(m.getMetrics().evictions).toBe(1);
    });

    it('does not record eviction when no capacity overflow', () => {
      const m = makeDecorator(100);
      m.set('a', entry());
      m.set('b', entry());
      expect(m.getMetrics().evictions).toBe(0);
    });
  });

  describe('eviction tracking via invalidateBy()', () => {
    it('adds invalidateBy return count to evictions', () => {
      const m = makeDecorator();
      m.set('User|a', entry());
      m.set('User|b', entry());
      m.set('Post|a', entry());

      m.invalidateBy((k) => k.startsWith('User|'));
      expect(m.getMetrics().evictions).toBe(2);
    });

    it('does not increment evictions when invalidateBy matches nothing', () => {
      const m = makeDecorator();
      m.set('Post|a', entry());
      m.invalidateBy((k) => k.startsWith('User|'));
      expect(m.getMetrics().evictions).toBe(0);
    });
  });

  describe('recordExpirations()', () => {
    it('increments expirations counter', () => {
      const m = makeDecorator();
      m.set('key', entry());
      m.invalidateBy((k) => k === 'key'); // counted as eviction first
      m.recordExpirations(1); // re-classify as expiration
      expect(m.getMetrics().expirations).toBe(1);
    });

    it('decrements evictions by the same amount', () => {
      const m = makeDecorator();
      m.set('a', entry());
      m.set('b', entry());
      m.invalidateBy(() => true); // 2 evictions
      m.recordExpirations(2);
      expect(m.getMetrics().evictions).toBe(0);
      expect(m.getMetrics().expirations).toBe(2);
    });

    it('does not make evictions negative', () => {
      const m = makeDecorator();
      m.recordExpirations(5); // no prior evictions
      expect(m.getMetrics().evictions).toBe(0);
      expect(m.getMetrics().expirations).toBe(5);
    });
  });

  describe('getMetrics()', () => {
    it('currentSize reflects inner store size', () => {
      const m = makeDecorator();
      m.set('a', entry());
      m.set('b', entry());
      expect(m.getMetrics().currentSize).toBe(2);
    });

    it('returns a snapshot (not live reference)', () => {
      const m = makeDecorator();
      const snap1 = m.getMetrics();
      m.set('x', entry());
      m.get('x');
      const snap2 = m.getMetrics();
      expect(snap1.hits).toBe(0);
      expect(snap2.hits).toBe(1);
    });
  });

  describe('clear()', () => {
    it('resets all counters', () => {
      const m = makeDecorator();
      m.set('key', entry());
      m.get('key');
      m.get('missing');
      m.clear();

      const metrics = m.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.evictions).toBe(0);
      expect(metrics.expirations).toBe(0);
      expect(metrics.hitRatio).toBe(0);
    });

    it('delegates to inner cache — data is also cleared', () => {
      const m = makeDecorator();
      m.set('key', entry());
      m.clear();
      expect(m.size()).toBe(0);
      expect(m.get('key')).toBeUndefined();
    });
  });
});
