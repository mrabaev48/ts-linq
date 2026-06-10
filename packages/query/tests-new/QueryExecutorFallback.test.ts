import type { DatabaseProvider } from '@ts-linq/core';
import { FallbackExhaustedError, type QueryFallback, type SqlParameter } from '@ts-linq/types';

import { QueryExecutor } from '../src/QueryExecutor';

interface TestEntity {
  id: number;
}

/**
 * Error-path coverage for the hedged select race (query/task-8): when every fallback source
 * fails AND the primary fails, the exhaustion must surface as a typed aggregate preserving the
 * primary error as `cause` — never as a silently-empty "successful" result.
 */
describe('QueryExecutor — hedged select fallback exhaustion', () => {
  const sql = { query: 'SELECT 1', parameters: [] as readonly SqlParameter[] };

  function makeExecutor(): QueryExecutor<TestEntity> {
    const provider = {
      providerLabel: 'test',
      loggerRef: undefined
    } as unknown as DatabaseProvider;
    // racePrimaryWithFallback only touches entityClass + provider; the other collaborators are
    // never reached on this path, so minimal stand-ins are safe.
    return new QueryExecutor<TestEntity>(
      class {} as new () => TestEntity,
      provider,
      {} as never,
      {} as never,
      {} as never,
      { fallbacks: [] } as never,
      undefined
    );
  }

  function failingFallback(label: string, error: Error): QueryFallback<TestEntity> {
    return {
      label,
      canHandle: () => true,
      execute: async () => {
        throw error;
      },
      fetch: async () => {
        throw error;
      }
    };
  }

  function dataFallback(label: string, rows: TestEntity[]): QueryFallback<TestEntity> {
    // execute/fetch are generic methods (<U>() => Promise<U[]>); cast the concrete rows through.
    return {
      label,
      canHandle: () => true,
      execute: async () => rows as unknown[] as never,
      fetch: async () => rows as unknown[] as never
    };
  }

  // Bound accessor to the private race method.
  function race(
    exec: QueryExecutor<TestEntity>,
    primary: () => Promise<ReadonlyArray<Record<string, unknown>>>,
    fallbacks: ReadonlyArray<QueryFallback<TestEntity>>
  ): Promise<unknown> {
    return (
      exec as unknown as {
        racePrimaryWithFallback: (
          p: typeof primary,
          s: typeof sql,
          d: number,
          f: typeof fallbacks
        ) => Promise<unknown>;
      }
    ).racePrimaryWithFallback(primary, sql, 0, fallbacks);
  }

  it('throws FallbackExhaustedError with the primary error as cause when all sources fail', async () => {
    const exec = makeExecutor();
    const primaryErr = new Error('primary down');
    const fbErr1 = new Error('fb1 down');
    const fbErr2 = new Error('fb2 down');

    let thrown: unknown;
    try {
      await race(exec, async () => {
        throw primaryErr;
      }, [failingFallback('fb1', fbErr1), failingFallback('fb2', fbErr2)]);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(FallbackExhaustedError);
    expect((thrown as FallbackExhaustedError).cause).toBe(primaryErr);
    // The collected per-source failures are preserved for debuggability.
    expect((thrown as FallbackExhaustedError).details?.errors).toEqual([fbErr1, fbErr2]);
  });

  it('distinguishes "no fallback configured" — rethrows the primary error unwrapped', async () => {
    const exec = makeExecutor();
    const primaryErr = new Error('primary down, no fallback');

    let thrown: unknown;
    try {
      await race(exec, async () => {
        throw primaryErr;
      }, []);
    } catch (e) {
      thrown = e;
    }

    // No fallbacks => not an exhaustion aggregate; the original failure surfaces unchanged.
    expect(thrown).toBe(primaryErr);
    expect(thrown).not.toBeInstanceOf(FallbackExhaustedError);
  });

  it('returns fallback data (not an aggregate) when a source still yields rows after primary fails', async () => {
    const exec = makeExecutor();
    const rows: TestEntity[] = [{ id: 1 }];

    const result = (await race(exec, async () => {
      throw new Error('primary down');
    }, [dataFallback('fb1', rows)])) as {
      source: string;
      rows: ReadonlyArray<unknown>;
      label: string;
    };

    expect(result.source).toBe('fallback');
    expect(result.rows).toEqual(rows);
    expect(result.label).toBe('fb1');
  });
});
