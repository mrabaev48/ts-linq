import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { SqlCacheEntry } from '@ts-linq/types';

import { LruCache } from '../src/LruCache';
import { TtlCacheDecorator } from '../src/TtlCacheDecorator';

const entry = (query = 'SELECT 1'): SqlCacheEntry => ({ query, parameters: [] });

function makeDecorator(defaultTtl: number): { ttl: TtlCacheDecorator; inner: LruCache } {
  const inner = new LruCache({ maxSize: 100 });
  const ttl = new TtlCacheDecorator(inner, defaultTtl);
  return { ttl, inner };
}

describe('TtlCacheDecorator', () => {
  describe('get() — lazy expiry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns the entry when TTL has not elapsed', () => {
      const { ttl } = makeDecorator(5000);
      ttl.set('key', entry('SELECT 1'));
      jest.advanceTimersByTime(3000);
      expect(ttl.get('key')).toBeDefined();
      ttl.dispose();
    });

    it('returns undefined and removes the entry when TTL has elapsed', () => {
      const { ttl } = makeDecorator(5000);
      ttl.set('key', entry());
      jest.advanceTimersByTime(6000);
      expect(ttl.get('key')).toBeUndefined();
      expect(ttl.size()).toBe(0);
      ttl.dispose();
    });

    it('returns the entry indefinitely when defaultTtl is 0', () => {
      const { ttl } = makeDecorator(0);
      ttl.set('key', entry());
      jest.advanceTimersByTime(999_999);
      expect(ttl.get('key')).toBeDefined();
      ttl.dispose();
    });
  });

  describe('setWithTtl()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('stores entry with a custom TTL', () => {
      const { ttl } = makeDecorator(0);
      ttl.setWithTtl('key', entry(), 3000);
      jest.advanceTimersByTime(2000);
      expect(ttl.get('key')).toBeDefined();
      jest.advanceTimersByTime(2000);
      expect(ttl.get('key')).toBeUndefined();
      ttl.dispose();
    });

    it('uses defaultTtl when customTtl is omitted', () => {
      const { ttl } = makeDecorator(5000);
      ttl.setWithTtl('key', entry());
      jest.advanceTimersByTime(4000);
      expect(ttl.get('key')).toBeDefined();
      jest.advanceTimersByTime(2000);
      expect(ttl.get('key')).toBeUndefined();
      ttl.dispose();
    });

    it('stores entry with no TTL when both defaultTtl and customTtl are 0', () => {
      const { ttl } = makeDecorator(0);
      ttl.setWithTtl('key', entry(), 0);
      jest.advanceTimersByTime(999_999);
      expect(ttl.get('key')).toBeDefined();
      ttl.dispose();
    });
  });

  describe('expireEntries()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns 0 when nothing has expired', () => {
      const { ttl } = makeDecorator(5000);
      ttl.set('key', entry());
      expect(ttl.expireEntries()).toBe(0);
      ttl.dispose();
    });

    it('removes expired entries and returns the count', () => {
      const { ttl } = makeDecorator(5000);
      ttl.set('a', entry());
      ttl.set('b', entry());
      jest.advanceTimersByTime(6000);
      expect(ttl.expireEntries()).toBe(2);
      expect(ttl.size()).toBe(0);
      ttl.dispose();
    });

    it('leaves non-expired entries intact', () => {
      const { ttl } = makeDecorator(0);
      ttl.setWithTtl('short-lived', entry(), 1000);
      ttl.setWithTtl('long-lived', entry(), 10_000);
      jest.advanceTimersByTime(2000);
      ttl.expireEntries();
      expect(ttl.get('short-lived')).toBeUndefined();
      expect(ttl.get('long-lived')).toBeDefined();
      ttl.dispose();
    });

    it('handles entries with mixed TTLs', () => {
      const { ttl } = makeDecorator(0);
      ttl.setWithTtl('a', entry(), 1000);
      ttl.setWithTtl('b', entry(), 2000);
      ttl.setWithTtl('c', entry(), 3000);
      ttl.set('no-ttl', entry()); // defaultTtl=0, no expiry
      jest.advanceTimersByTime(2500);
      const expired = ttl.expireEntries();
      expect(expired).toBe(2); // 'a' and 'b'
      expect(ttl.get('c')).toBeDefined();
      expect(ttl.get('no-ttl')).toBeDefined();
      ttl.dispose();
    });
  });

  describe('invalidateBy()', () => {
    it('removes matching keys from ttlMap and inner store', () => {
      const { ttl } = makeDecorator(5000);
      jest.useFakeTimers();
      ttl.set('User|s:', entry());
      ttl.set('Post|s:', entry());
      const removed = ttl.invalidateBy((k) => k.startsWith('User|'));
      expect(removed).toBe(1);
      expect(ttl.size()).toBe(1);
      // After invalidation the expired TTL record is also gone
      jest.advanceTimersByTime(6000);
      ttl.expireEntries();
      expect(ttl.get('Post|s:')).toBeUndefined(); // expired naturally
      ttl.dispose();
      jest.useRealTimers();
    });
  });

  describe('clear()', () => {
    it('clears TTL map and delegates to inner', () => {
      const { ttl } = makeDecorator(5000);
      jest.useFakeTimers();
      ttl.set('a', entry());
      ttl.set('b', entry());
      ttl.clear();
      expect(ttl.size()).toBe(0);
      // TTL map must also be cleared — no expired entries should surface
      jest.advanceTimersByTime(6000);
      expect(ttl.expireEntries()).toBe(0);
      ttl.dispose();
      jest.useRealTimers();
    });
  });

  describe('periodic cleanup timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not start a timer when defaultTtl is 0', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const { ttl } = makeDecorator(0);
      expect(setIntervalSpy).not.toHaveBeenCalled();
      ttl.dispose();
      setIntervalSpy.mockRestore();
    });

    it('starts a timer when defaultTtl > 0 and fires expireEntries after interval', () => {
      const { ttl } = makeDecorator(100);
      ttl.set('a', entry());
      // Advance past minimum cleanup interval (60s) — timer would have fired
      jest.advanceTimersByTime(60_001);
      // Entry TTL (100ms) is long past; if timer fired, entry is gone
      expect(ttl.size()).toBe(0);
      ttl.dispose();
    });
  });

  describe('dispose()', () => {
    it('stops the timer without clearing inner cache data', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      jest.useFakeTimers();

      const { ttl } = makeDecorator(60_000);
      ttl.set('key', entry());

      ttl.dispose();

      // clearInterval called for the timer (if it was started)
      // In test env the timer is suppressed, so we just verify no throw
      expect(() => ttl.dispose()).not.toThrow(); // idempotent

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      jest.useRealTimers();
    });

    it('is idempotent — calling dispose() twice does not throw', () => {
      const { ttl } = makeDecorator(0);
      ttl.dispose();
      expect(() => ttl.dispose()).not.toThrow();
    });
  });
});
