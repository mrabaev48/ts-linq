import { CompositeSqlLogger } from '../src/utils/CompositeSqlLogger';
import { CompositeSqlLoggerFactory } from '../src/utils/CompositeSqlLoggerFactory';
import type { SqlLogger, SqlLoggerFactory } from '../src/types';

describe('CompositeSqlLogger', () => {
  test('fan-outs queryStart/queryEnd/retry/transaction/cache to all delegates', () => {
    const calls: string[] = [];
    const makeLogger = (id: string): SqlLogger => ({
      queryStart: () => calls.push(`${id}:qs`),
      queryEnd: () => calls.push(`${id}:qe`),
      retry: () => calls.push(`${id}:r`),
      transactionStart: () => calls.push(`${id}:ts`),
      transactionEnd: () => calls.push(`${id}:te`),
      cache: (i) => calls.push(`${id}:c:${i.cache}:${i.hit ? 'H' : 'M'}`)
    });

    const c = new CompositeSqlLogger(makeLogger('A'), makeLogger('B'));
    c.queryStart({ sql: 'SELECT 1', params: [] });
    c.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 5 });
    c.retry({ sql: 'SELECT 1', params: [], attempt: 1 });
    c.transactionStart({});
    c.transactionEnd({});
    c.cache({ cache: 'sqlGen', hit: true });

    expect(calls).toEqual([
      'A:qs',
      'B:qs',
      'A:qe',
      'B:qe',
      'A:r',
      'B:r',
      'A:ts',
      'B:ts',
      'A:te',
      'B:te',
      'A:c:sqlGen:H',
      'B:c:sqlGen:H'
    ]);
  });

  test('swallows delegate errors', () => {
    const ok: SqlLogger = { queryStart: jest.fn() };
    const bad: SqlLogger = { queryStart: () => { throw new Error('boom'); } };
    const c = new CompositeSqlLogger(bad, ok);
    expect(() => c.queryStart({ sql: 'SELECT 1', params: [] })).not.toThrow();
    expect((ok.queryStart as jest.Mock).mock.calls.length).toBe(1);
  });
});

describe('CompositeSqlLoggerFactory', () => {
  test('composes results from factories and static loggers', () => {
    const lA: SqlLogger = { queryStart: jest.fn() };
    const lB: SqlLogger = { queryStart: jest.fn() };
    const f1: SqlLoggerFactory = { create: (p) => (p === 'sqlite' ? lA : undefined) };
    const f2: SqlLoggerFactory = { create: () => lB };
    const staticL: SqlLogger = { queryEnd: jest.fn() };

    const factory = new CompositeSqlLoggerFactory({ factories: [f1, f2], loggers: [staticL] });
    const comp = factory.create('sqlite');
    expect(comp).toBeTruthy();
    comp!.queryStart?.({ sql: 'SELECT 1', params: [] });
    comp!.queryEnd?.({ sql: 'SELECT 1', params: [], durationMs: 1 });

    expect((lA.queryStart as jest.Mock).mock.calls.length).toBe(1);
    expect((lB.queryStart as jest.Mock).mock.calls.length).toBe(1);
    expect((staticL.queryEnd as jest.Mock).mock.calls.length).toBe(1);
  });

  test('returns undefined when no delegates found', () => {
    const factory = new CompositeSqlLoggerFactory();
    const comp = factory.create('postgresql');
    expect(comp).toBeUndefined();
  });
});


