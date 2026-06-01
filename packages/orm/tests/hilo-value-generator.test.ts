import type { ValueGeneratorContext } from '@ts-linq/types';

import { HiLoValueGenerator } from '../src/valueGenerators/HiLoValueGenerator';

const ctx: ValueGeneratorContext = { entityClass: class {}, propertyName: 'id' };

function makeFetch(returns: number[]): jest.Mock {
  const mock = jest.fn();
  for (const v of returns) mock.mockResolvedValueOnce(v);
  return mock;
}

describe('HiLoValueGenerator (P1-21)', () => {
  it('throws when blockSize < 1', () => {
    expect(() => new HiLoValueGenerator('seq', undefined, 0, jest.fn())).toThrow(RangeError);
  });

  it('fetches a block on first ensureBlock() call', async () => {
    const fetch = makeFetch([10]);
    const gen = new HiLoValueGenerator('seq', undefined, 10, fetch);
    await gen.ensureBlock();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('seq', undefined, 10);
  });

  it('returns ids within the reserved block without additional fetch', async () => {
    const fetch = makeFetch([10]); // hi=10, lo=1
    const gen = new HiLoValueGenerator('seq', undefined, 10, fetch);
    await gen.ensureBlock();
    const ids = Array.from({ length: 10 }, () => gen.next(ctx));
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches a new block when the current block is exhausted', async () => {
    const fetch = makeFetch([10, 20]); // first block 1-10, second 11-20
    const gen = new HiLoValueGenerator('seq', undefined, 10, fetch);
    await gen.ensureBlock();
    for (let i = 0; i < 10; i++) gen.next(ctx);
    // block exhausted, ensureBlock() must fetch again
    await gen.ensureBlock();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(gen.next(ctx)).toBe(11);
  });

  it('ensureBlock() is idempotent when block is not exhausted', async () => {
    const fetch = makeFetch([10]);
    const gen = new HiLoValueGenerator('seq', undefined, 10, fetch);
    await gen.ensureBlock();
    await gen.ensureBlock();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws synchronously when next() is called without ensureBlock()', () => {
    const gen = new HiLoValueGenerator('seq', undefined, 10, jest.fn());
    expect(() => gen.next(ctx)).toThrow();
  });

  it('passes schema to fetchNextBlock', async () => {
    const fetch = makeFetch([5]);
    const gen = new HiLoValueGenerator('seq', 'shared', 5, fetch);
    await gen.ensureBlock();
    expect(fetch).toHaveBeenCalledWith('seq', 'shared', 5);
  });

  it('blockSize of 1 reserves single IDs', async () => {
    const fetch = makeFetch([1, 2, 3]);
    const gen = new HiLoValueGenerator('seq', undefined, 1, fetch);
    await gen.ensureBlock();
    expect(gen.next(ctx)).toBe(1);
    await gen.ensureBlock();
    expect(gen.next(ctx)).toBe(2);
    await gen.ensureBlock();
    expect(gen.next(ctx)).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
