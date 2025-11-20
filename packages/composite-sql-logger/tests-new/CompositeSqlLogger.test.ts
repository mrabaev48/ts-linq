import { CompositeSqlLogger } from '../src/logger/CompositeSqlLogger';
import type { SqlLogger } from '@ts-linq/types';

function makeSpyLogger() {
  const calls: Record<string, unknown>[] = [];
  const logger: SqlLogger = {
    debug: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'debug' }),
    info: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'info' }),
    warn: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'warn' }),
    error: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'error' }),
    queryStart: (i) => calls.push({ t: 'qs', i }),
    queryEnd: (i) => calls.push({ t: 'qe', i }),
    transaction: (i) => calls.push({ t: 'tx', i }),
    retry: (i) => calls.push({ t: 'rt', i }),
    cache: (i) => calls.push({ t: 'cache', i }),
    circuit: (i) => calls.push({ t: 'circuit', i }),
    health: (i) => calls.push({ t: 'health', i }),
    fallback: (i) => calls.push({ t: 'fallback', i }),
    hedgedStart: (i) => calls.push({ t: 'hedgedStart', i }),
    hedgedWin: (i) => calls.push({ t: 'hedgedWin', i })
  };
  return { logger, calls };
}

describe('CompositeSqlLogger (tests-new)', () => {
  test('delegates to multiple loggers and skips falsy', () => {
    const a = makeSpyLogger();
    const b = makeSpyLogger();
    const c = undefined;
    const comp = new CompositeSqlLogger(a.logger, c as unknown as SqlLogger, b.logger);
    comp.info('hello', { x: 1 });
    expect(a.calls.length).toBe(1);
    expect(b.calls.length).toBe(1);
  });

  test('delegates query lifecycle and cleansly handles errors from delegates', () => {
    const ok = makeSpyLogger();
    const bad: SqlLogger = {
      debug() {},
      info() {},
      warn() {},
      error() {},
      queryStart() {
        throw new Error('boom');
      },
      queryEnd() {
        throw new Error('boom');
      },
      transaction() {},
      retry() {},
      cache() {},
      circuit() {},
      health() {},
      fallback() {},
      hedgedStart() {},
      hedgedWin() {}
    };
    const comp = new CompositeSqlLogger(ok.logger, bad);
    expect(() =>
      comp.queryStart({ sql: 'select 1', params: [], provider: 'sqlite' })
    ).not.toThrow();
    expect(() =>
      comp.queryEnd({ sql: 'select 1', params: [], durationMs: 1, provider: 'sqlite' })
    ).not.toThrow();
    // calls recorded only to ok
    expect(ok.calls.some((x) => x.t === 'qs')).toBe(true);
    expect(ok.calls.some((x) => x.t === 'qe')).toBe(true);
  });

  test('delegates analysis if available', () => {
    const received: unknown[] = [];
    const custom: SqlLogger = {
      debug() {},
      info() {},
      warn() {},
      error() {},
      queryStart() {},
      queryEnd() {},
      transaction() {},
      retry() {},
      cache() {},
      circuit() {},
      health() {},
      fallback() {},
      hedgedStart() {},
      hedgedWin() {}
    };
    // attach optional analysis
    (custom as unknown as { analysis?: (i: unknown) => void }).analysis = (i) => received.push(i);
    const comp = new CompositeSqlLogger(custom);
    comp.analysis({
      sql: 's',
      params: [],
      durationMs: 10,
      provider: 'sqlite',
      slow: true,
      recommendations: ['idx']
    });
    expect(received.length).toBe(1);
  });
});


