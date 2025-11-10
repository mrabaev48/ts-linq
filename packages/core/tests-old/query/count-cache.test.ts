import { InMemoryCountCache } from '../../src/query/CountCache';

describe('InMemoryCountCache', () => {
  test('returns undefined when expired by TTL', () => {
    jest.useFakeTimers();
    const cache = new InMemoryCountCache(100, 10);
    cache.set('k', { value: 1, ts: Date.now() });
    jest.advanceTimersByTime(101);
    expect(cache.get('k')).toBeUndefined();
    jest.useRealTimers();
  });

  test('FIFO eviction when max size exceeded', () => {
    const cache = new InMemoryCountCache(0, 2);
    cache.set('a', { value: 1, ts: Date.now() });
    cache.set('b', { value: 2, ts: Date.now() });
    cache.set('c', { value: 3, ts: Date.now() });
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')?.value).toBe(2);
    expect(cache.get('c')?.value).toBe(3);
  });

  test('clear removes all entries', () => {
    const cache = new InMemoryCountCache();
    cache.set('x', { value: 1, ts: Date.now() });
    cache.clear();
    expect(cache.get('x')).toBeUndefined();
  });
});
