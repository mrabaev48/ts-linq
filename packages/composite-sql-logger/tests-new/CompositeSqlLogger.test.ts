import type {
  CacheInfo,
  CircuitEventInfo,
  ConnectionHealthInfo,
  FallbackInfo,
  HedgedWinInfo,
  QueryAnalysisInfo,
  QueryEndInfo,
  QueryStartInfo,
  RetryInfo,
  SqlLogger,
  TransactionInfo
} from '@ts-linq/types';

import { CompositeSqlLogger } from '../src/logger/CompositeSqlLogger';

function makeSpyLogger() {
  const calls: Record<string, unknown>[] = [];
  const logger: SqlLogger = {
    debug: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'debug' }),
    info: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'info' }),
    warn: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'warn' }),
    error: (m: string, meta?: Record<string, unknown>) => calls.push({ m, meta, t: 'error' }),
    queryStart: (i: QueryStartInfo) => calls.push({ t: 'qs', i }),
    queryEnd: (i: QueryEndInfo) => calls.push({ t: 'qe', i }),
    transactionStart: (i: TransactionInfo) => calls.push({ t: 'tx_start', i }),
    transactionEnd: (i: TransactionInfo) => calls.push({ t: 'tx_end', i }),
    retry: (i: RetryInfo) => calls.push({ t: 'rt', i }),
    cache: (i: CacheInfo) => calls.push({ t: 'cache', i }),
    circuit: (i: CircuitEventInfo) => calls.push({ t: 'circuit', i }),
    connectionHealth: (i: ConnectionHealthInfo) => calls.push({ t: 'health', i }),
    fallback: (i: FallbackInfo) => calls.push({ t: 'fallback', i }),
    hedgedWin: (i: HedgedWinInfo) => calls.push({ t: 'hedgedWin', i })
  };
  return { logger, calls };
}

describe('CompositeSqlLogger (tests-new)', () => {
  test('delegates to multiple loggers and skips falsy', () => {
    const a = makeSpyLogger();
    const b = makeSpyLogger();
    const c = undefined;
    const comp = new CompositeSqlLogger(a.logger, c, b.logger);
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
      queryStart(_i: QueryStartInfo) {
        throw new Error('boom');
      },
      queryEnd(_i: QueryEndInfo) {
        throw new Error('boom');
      },
      transactionStart(_i: TransactionInfo) {},
      transactionEnd(_i: TransactionInfo) {},
      retry(_i: RetryInfo) {},
      cache(_i: CacheInfo) {},
      circuit(_i: CircuitEventInfo) {},
      connectionHealth(_i: ConnectionHealthInfo) {},
      fallback(_i: FallbackInfo) {},
      hedgedWin(_i: HedgedWinInfo) {}
    };
    const comp = new CompositeSqlLogger(ok.logger, bad);
    expect(() =>
      comp.queryStart({ sql: 'select 1', params: [], provider: 'postgresql' })
    ).not.toThrow();
    expect(() =>
      comp.queryEnd({ sql: 'select 1', params: [], durationMs: 1, provider: 'postgresql' })
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
      queryStart(_i: QueryStartInfo) {},
      queryEnd(_i: QueryEndInfo) {},
      transactionStart(_i: TransactionInfo) {},
      transactionEnd(_i: TransactionInfo) {},
      retry(_i: RetryInfo) {},
      cache(_i: CacheInfo) {},
      circuit(_i: CircuitEventInfo) {},
      connectionHealth(_i: ConnectionHealthInfo) {},
      fallback(_i: FallbackInfo) {},
      hedgedWin(_i: HedgedWinInfo) {}
    };
    // attach optional analysis
    (custom as unknown as { analysis?: (i: QueryAnalysisInfo) => void }).analysis = (i) =>
      received.push(i);
    const comp = new CompositeSqlLogger(custom);
    comp.analysis({
      sql: 's',
      params: [],
      durationMs: 10,
      provider: 'postgresql',
      slow: true,
      recommendations: ['idx']
    });
    expect(received.length).toBe(1);
  });
});
