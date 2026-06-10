import type { SqlLogger } from '@ts-linq/types';

import { CompositeSqlLogger } from '../src/logging/CompositeSqlLogger';
import { setInternalErrorHandler } from '../src/utils/InternalLogger';

/** Build a fully-stubbed SqlLogger whose every method is a jest mock. */
function makeLogger(): jest.Mocked<Required<SqlLogger>> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    cache: jest.fn(),
    queryStart: jest.fn(),
    queryEnd: jest.fn(),
    retry: jest.fn(),
    transactionStart: jest.fn(),
    transactionEnd: jest.fn(),
    connectionHealth: jest.fn(),
    circuit: jest.fn(),
    fallback: jest.fn(),
    hedgedWin: jest.fn(),
    analysis: jest.fn(),
    crossQuery: jest.fn(),
    cacheSize: jest.fn()
  };
}

describe('CompositeSqlLogger', () => {
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

  it('forwards every event to all delegates', () => {
    const a = makeLogger();
    const b = makeLogger();
    const composite = new CompositeSqlLogger(a, b);

    composite.debug('d', { k: 1 });
    composite.info('i');
    composite.warn('w');
    composite.error('e');
    composite.queryStart({ sql: 's', params: [] });
    composite.queryEnd({ sql: 's', params: [], durationMs: 1 });
    composite.retry({ sql: 's', params: [], attempt: 1 });
    composite.transactionStart({});
    composite.transactionEnd({});
    composite.cache({ cache: 'sqlGen', hit: true });
    composite.connectionHealth({ healthy: true });
    composite.circuit({ state: 'closed' });
    composite.fallback({ fallback: 'f', attempted: true });
    composite.hedgedWin({ operation: 'op', fallback: 'f' });
    composite.analysis({ sql: 's', params: [], durationMs: 1 });
    composite.crossQuery({ op: 'IN-chunk', chunks: 1, size: 1, entity: 'E', column: 'c' });
    composite.cacheSize({ cache: 'sqlGen', size: 1 });

    for (const delegate of [a, b]) {
      expect(delegate.debug).toHaveBeenCalledWith('d', { k: 1 });
      expect(delegate.info).toHaveBeenCalledWith('i', undefined);
      expect(delegate.warn).toHaveBeenCalledWith('w', undefined);
      expect(delegate.error).toHaveBeenCalledWith('e', undefined);
      expect(delegate.queryStart).toHaveBeenCalledTimes(1);
      expect(delegate.queryEnd).toHaveBeenCalledTimes(1);
      expect(delegate.retry).toHaveBeenCalledTimes(1);
      expect(delegate.transactionStart).toHaveBeenCalledTimes(1);
      expect(delegate.transactionEnd).toHaveBeenCalledTimes(1);
      expect(delegate.cache).toHaveBeenCalledTimes(1);
      expect(delegate.connectionHealth).toHaveBeenCalledTimes(1);
      expect(delegate.circuit).toHaveBeenCalledTimes(1);
      expect(delegate.fallback).toHaveBeenCalledTimes(1);
      expect(delegate.hedgedWin).toHaveBeenCalledTimes(1);
      expect(delegate.analysis).toHaveBeenCalledTimes(1);
      expect(delegate.crossQuery).toHaveBeenCalledTimes(1);
      expect(delegate.cacheSize).toHaveBeenCalledTimes(1);
    }
  });

  it('isolates a throwing delegate so the others still receive the event', () => {
    const throwing = makeLogger();
    throwing.queryStart.mockImplementation(() => {
      throw new Error('delegate boom');
    });
    const healthy = makeLogger();
    const composite = new CompositeSqlLogger(throwing, healthy);

    expect(() => composite.queryStart({ sql: 's', params: [] })).not.toThrow();

    expect(throwing.queryStart).toHaveBeenCalledTimes(1);
    expect(healthy.queryStart).toHaveBeenCalledTimes(1);
    // The swallowed failure is surfaced through the internal-error boundary.
    expect(internalErrors).toHaveBeenCalled();
    expect(internalErrors.mock.calls[0][0]).toContain('CompositeSqlLogger.queryStart');
  });

  it('tolerates delegates that omit optional methods', () => {
    const minimal: SqlLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    const composite = new CompositeSqlLogger(minimal);

    expect(() => composite.queryStart({ sql: 's', params: [] })).not.toThrow();
    expect(() => composite.analysis({ sql: 's', params: [], durationMs: 1 })).not.toThrow();
    expect(internalErrors).not.toHaveBeenCalled();
  });

  it('skips nullish delegates and flattens nested composites', () => {
    const a = makeLogger();
    const b = makeLogger();
    const inner = new CompositeSqlLogger(a, undefined, null);
    const outer = new CompositeSqlLogger(inner, b);

    outer.info('hello');

    expect(a.info).toHaveBeenCalledTimes(1);
    expect(b.info).toHaveBeenCalledTimes(1);
  });
});
