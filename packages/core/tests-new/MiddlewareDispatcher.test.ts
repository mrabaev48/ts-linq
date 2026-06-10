import { describe, expect, it } from '@jest/globals';
import type { OrmMiddleware } from '@ts-linq/types';

import { MiddlewareDispatcher } from '../src/middleware/MiddlewareDispatcher';
import { setInternalErrorHandler } from '../src/utils/InternalLogger';

describe('MiddlewareDispatcher', () => {
  let internalErrors: jest.Mock<void, [string, unknown]>;

  beforeEach(() => {
    // The internal telemetry channel is silent by default; install a spy
    // handler so isolation tests can assert the swallowed error was surfaced.
    internalErrors = jest.fn<void, [string, unknown]>();
    setInternalErrorHandler(internalErrors);
  });

  afterEach(() => {
    setInternalErrorHandler(undefined);
  });

  it('reads the middleware list lazily on each call', async () => {
    let middlewares: OrmMiddleware[] | undefined;
    const seen: string[] = [];
    const d = new MiddlewareDispatcher(() => middlewares);

    await d.beforeExecute('SELECT 1', []); // none yet
    middlewares = [{ beforeExecute: () => void seen.push('a') }];
    await d.beforeExecute('SELECT 1', []);

    expect(seen).toEqual(['a']);
  });

  it('propagates errors from beforeExecute (no isolation)', async () => {
    const d = new MiddlewareDispatcher(() => [
      {
        beforeExecute: () => {
          throw new Error('veto');
        }
      }
    ]);
    await expect(d.beforeExecute('SELECT 1', [])).rejects.toThrow('veto');
  });

  it('isolates a throwing afterExecute middleware and computes rows', async () => {
    const rowsSeen: Array<number | undefined> = [];
    const d = new MiddlewareDispatcher(() => [
      {
        afterExecute: (info) => {
          rowsSeen.push(info.rows);
          throw new Error('boom');
        }
      },
      { afterExecute: (info) => void rowsSeen.push(info.rows) }
    ]);

    await expect(d.afterExecute('SELECT 1', [], [{}, {}, {}], 5)).resolves.toBeUndefined();
    expect(rowsSeen).toEqual([3, 3]);
    expect(internalErrors).toHaveBeenCalled();
  });

  it('isolates a throwing entityMaterialized middleware', async () => {
    const d = new MiddlewareDispatcher(() => [
      {
        entityMaterialized: () => {
          throw new Error('boom');
        }
      }
    ]);
    await expect(d.entityMaterialized({})).resolves.toBeUndefined();
    expect(internalErrors).toHaveBeenCalled();
  });
});
