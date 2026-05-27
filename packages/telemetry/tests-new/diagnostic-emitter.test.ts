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
