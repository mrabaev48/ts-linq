import type { DiagnosticConfig } from '@ts-linq/types';

import { DiagnosticEmitter } from '../src/diagnostic-emitter';
import { EfWarningError } from '../src/warning-router';

function makeEmitter(overrides: Partial<DiagnosticConfig> = {}): {
  emitter: DiagnosticEmitter;
  messages: string[];
} {
  const messages: string[] = [];
  const emitter = new DiagnosticEmitter({
    sink: (m) => messages.push(m),
    level: 'debug',
    ...overrides
  });
  return { emitter, messages };
}

describe('DiagnosticEmitter — log-level filtering', () => {
  it('forwards messages at or above the configured level', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.info('hello');
    emitter.warn('world');
    emitter.error('boom');
    expect(messages).toEqual(['hello', 'world', 'boom']);
  });

  it('suppresses messages below the configured level', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.debug('too low');
    expect(messages).toHaveLength(0);
  });

  it('forwards nothing when level is none', () => {
    const { emitter, messages } = makeEmitter({ level: 'none' });
    emitter.debug('d');
    emitter.info('i');
    emitter.error('e');
    expect(messages).toHaveLength(0);
  });

  it('forwards everything when level is trace', () => {
    const { emitter, messages } = makeEmitter({ level: 'trace' });
    emitter.debug('d');
    emitter.info('i');
    expect(messages).toHaveLength(2);
  });
});

describe('DiagnosticEmitter — parameter masking', () => {
  it('masks params by default (sensitiveData = false)', () => {
    const { emitter, messages } = makeEmitter();
    emitter.queryStart({ sql: 'SELECT ?', params: ['secret-value'], traceId: '1' });
    expect(messages[0]).toContain(':p0');
    expect(messages[0]).not.toContain('secret-value');
  });

  it('exposes raw params when sensitiveDataEnabled = true', () => {
    const { emitter, messages } = makeEmitter({ sensitiveDataEnabled: true });
    emitter.queryStart({ sql: 'SELECT ?', params: ['secret-value'], traceId: '1' });
    expect(messages[0]).toContain('secret-value');
  });
});

describe('DiagnosticEmitter — detailed errors', () => {
  it('omits stack trace by default', () => {
    const { emitter, messages } = makeEmitter({ level: 'error' });
    const err = new Error('db fail');
    err.stack = 'Error: db fail\n  at fn (file.ts:10)';
    emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 5, traceId: '1', error: err });
    expect(messages[0]).not.toContain('at fn');
  });

  it('appends stack trace when detailedErrors = true', () => {
    const { emitter, messages } = makeEmitter({ level: 'error', detailedErrors: true });
    const err = new Error('db fail');
    err.stack = 'Error: db fail\n  at fn (file.ts:10)';
    emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 5, traceId: '1', error: err });
    expect(messages[0]).toContain('at fn');
  });
});

describe('DiagnosticEmitter — warning routing', () => {
  it('throws EfWarningError when route is throw', () => {
    const routes = new Map([['core.query-error', 'throw' as const]]);
    const { emitter } = makeEmitter({ level: 'error', warningRoutes: routes });
    const err = new Error('db fail');
    expect(() =>
      emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 1, traceId: '1', error: err })
    ).toThrow(EfWarningError);
  });

  it('suppresses event when route is suppress', () => {
    const routes = new Map([['core.query-end', 'suppress' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'debug', warningRoutes: routes });
    emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 1, traceId: '1' });
    expect(messages).toHaveLength(0);
  });

  it('forces log even when level is above normal threshold when route is log', () => {
    const routes = new Map([['core.query-end', 'log' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'error', warningRoutes: routes });
    emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 1, traceId: '1' });
    expect(messages).toHaveLength(1);
  });
});

describe('DiagnosticEmitter — text-log routing', () => {
  it('suppress("core.log-warn") silences warn() output', () => {
    const routes = new Map([['core.log-warn', 'suppress' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'debug', warningRoutes: routes });
    emitter.warn('careful');
    expect(messages).toHaveLength(0);
  });

  it('suppress("core.log-warn") does not affect other text levels', () => {
    const routes = new Map([['core.log-warn', 'suppress' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'debug', warningRoutes: routes });
    emitter.info('still here');
    emitter.error('also here');
    expect(messages).toEqual(['still here', 'also here']);
  });

  it('level filtering still applies to a non-suppressed text log', () => {
    const routes = new Map([['core.log-warn', 'suppress' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'warning', warningRoutes: routes });
    // info is below the configured warning level → filtered out by level, not by route
    emitter.info('below threshold');
    expect(messages).toHaveLength(0);
  });

  it('throw("core.log-error") raises EfWarningError from error()', () => {
    const routes = new Map([['core.log-error', 'throw' as const]]);
    const { emitter } = makeEmitter({ level: 'error', warningRoutes: routes });
    expect(() => emitter.error('boom')).toThrow(EfWarningError);
  });

  it('log("core.log-debug") forces output even when level is above the threshold', () => {
    const routes = new Map([['core.log-debug', 'log' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'error', warningRoutes: routes });
    emitter.debug('forced');
    expect(messages).toEqual(['forced']);
  });

  it('default (no routes) text-log behaviour is unchanged', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.debug('d');
    emitter.info('i');
    emitter.warn('w');
    emitter.error('e');
    // debug is below information and dropped; the rest pass through unchanged
    expect(messages).toEqual(['i', 'w', 'e']);
  });
});

describe('DiagnosticEmitter — queryEnd success', () => {
  it('includes duration in output', () => {
    const { emitter, messages } = makeEmitter();
    emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 42, traceId: '1' });
    expect(messages[0]).toContain('42ms');
  });

  it('includes row count when present', () => {
    const { emitter, messages } = makeEmitter();
    emitter.queryEnd({ sql: 'SELECT 1', params: [], durationMs: 1, traceId: '1', rows: 7 });
    expect(messages[0]).toContain('7 rows');
  });
});

describe('DiagnosticEmitter — retry', () => {
  it('logs retry attempt at warning level', () => {
    const { emitter, messages } = makeEmitter({ level: 'warning' });
    emitter.retry({ sql: 'SELECT 1', params: [], attempt: 3, traceId: '1' });
    expect(messages[0]).toContain('#3');
  });
});

describe('DiagnosticEmitter — no-op when sink absent', () => {
  it('does not throw when sink is undefined (defaults to no-op)', () => {
    const emitter = new DiagnosticEmitter({ level: 'debug' });
    expect(() => emitter.info('test')).not.toThrow();
  });
});

describe('DiagnosticEmitter — resilience events routing', () => {
  it('circuit (open) surfaces at default level (information)', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.circuit({ state: 'open', failures: 5, reason: 'timeout' });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Circuit open');
    expect(messages[0]).toContain('timeout');
    expect(messages[0]).toContain('failures: 5');
  });

  it('fallback with succeeded=false routes at error level', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.fallback({ fallback: 'cache', attempted: true, succeeded: false });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('failed');
  });

  it('fallback with succeeded=true routes at warning level', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.fallback({ fallback: 'cache', attempted: true, succeeded: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('succeeded');
  });

  it('fallback marks stale data', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.fallback({ fallback: 'cache', attempted: true, succeeded: true, isStale: true });
    expect(messages[0]).toContain('[stale]');
  });

  it('connectionHealth unhealthy surfaces at default level (information)', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.connectionHealth({ healthy: false, latencyMs: 250 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('unhealthy');
    expect(messages[0]).toContain('250ms');
  });

  it('connectionHealth healthy is suppressed at default level (debug < information)', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.connectionHealth({ healthy: true });
    expect(messages).toHaveLength(0);
  });

  it('cache hit is suppressed at default level (trace < information)', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.cache({ cache: 'sqlGen', hit: true });
    expect(messages).toHaveLength(0);
  });

  it('cache hit surfaces when level is trace', () => {
    const { emitter, messages } = makeEmitter({ level: 'trace' });
    emitter.cache({ cache: 'sqlGen', hit: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Cache hit');
  });

  it('suppress("core.circuit-open") silences circuit event', () => {
    const routes = new Map([['core.circuit-open', 'suppress' as const]]);
    const { emitter, messages } = makeEmitter({ level: 'information', warningRoutes: routes });
    emitter.circuit({ state: 'open', failures: 3 });
    expect(messages).toHaveLength(0);
  });

  it('throw("core.circuit-open") escalates to EfWarningError', () => {
    const routes = new Map([['core.circuit-open', 'throw' as const]]);
    const { emitter } = makeEmitter({ level: 'information', warningRoutes: routes });
    expect(() => emitter.circuit({ state: 'open', failures: 3 })).toThrow(EfWarningError);
  });

  it('cacheSize is suppressed at default level (trace < information)', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.cacheSize({ cache: 'sqlGen', size: 100 });
    expect(messages).toHaveLength(0);
  });

  it('crossQuery is suppressed at default level (debug < information)', () => {
    const { emitter, messages } = makeEmitter({ level: 'information' });
    emitter.crossQuery({ op: 'IN-chunk', entity: 'User', column: 'id', chunks: 2, size: 1000 });
    expect(messages).toHaveLength(0);
  });

  it('crossQuery surfaces when level is debug', () => {
    const { emitter, messages } = makeEmitter({ level: 'debug' });
    emitter.crossQuery({ op: 'IN-chunk', entity: 'User', column: 'id', chunks: 2, size: 1000 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('User.id');
  });

  it('hedgedWin surfaces when level is debug', () => {
    const { emitter, messages } = makeEmitter({ level: 'debug' });
    emitter.hedgedWin({ fallback: 'replica', operation: 'findAll' });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('replica');
  });

  it('analysis surfaces when level is debug', () => {
    const { emitter, messages } = makeEmitter({ level: 'debug' });
    emitter.analysis({ sql: 'SELECT 1', params: [], durationMs: 120, slow: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('[SLOW]');
    expect(messages[0]).toContain('120ms');
  });
});
