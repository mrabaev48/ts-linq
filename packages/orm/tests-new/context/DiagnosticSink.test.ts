/**
 * Unit tests for the DiagnosticSink abstraction (refactor orm/task-2).
 *
 * Verifies the three sanctioned routings (debug / warn / observable staleness),
 * the Null Object behaviour, and the factory's logger-vs-NullObject selection.
 */
import { describe, expect, it } from '@jest/globals';
import type { SqlLogger } from '@ts-linq/types';

import { createDiagnosticSink, NULL_DIAGNOSTIC_SINK } from '../../src/context/DiagnosticSink';

interface Capture {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, unknown>;
}

function makeCapturingLogger(): { logger: SqlLogger; calls: Capture[] } {
  const calls: Capture[] = [];
  const push = (level: Capture['level']) => (message: string, meta?: Record<string, unknown>) =>
    calls.push({ level, message, meta });
  const logger: SqlLogger = {
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error')
  };
  return { logger, calls };
}

describe('DiagnosticSink', () => {
  it('internalDiag defaults to warn and carries the label + safe error shape', () => {
    const { logger, calls } = makeCapturingLogger();
    const sink = createDiagnosticSink(logger);

    sink.internalDiag('DbContext.cache.reportMetrics', new Error('boom'));

    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe('warn');
    expect(calls[0].message).toContain('DbContext.cache.reportMetrics');
    expect(calls[0].meta).toMatchObject({
      label: 'DbContext.cache.reportMetrics',
      error: { name: 'Error', message: 'boom' }
    });
  });

  it('internalDiag routes to debug for valid-recovery paths', () => {
    const { logger, calls } = makeCapturingLogger();
    const sink = createDiagnosticSink(logger);

    sink.internalDiag('DbContext.cache.warmUp.task', new Error('nope'), 'debug');

    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe('debug');
  });

  it('cacheStaleAfterCommit emits an observable structured staleness warning', () => {
    const { logger, calls } = makeCapturingLogger();
    const sink = createDiagnosticSink(logger);

    sink.cacheStaleAfterCommit('DbContext.commitTransaction.invalidateCaches', 'oops');

    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe('warn');
    expect(calls[0].meta).toMatchObject({
      label: 'DbContext.commitTransaction.invalidateCaches',
      staleCache: true,
      error: { message: 'oops' }
    });
  });

  it('reduces non-Error throwables to a safe message shape', () => {
    const { logger, calls } = makeCapturingLogger();
    const sink = createDiagnosticSink(logger);

    sink.internalDiag('label', { secret: 'do-not-leak' });

    expect(calls[0].meta?.error).toEqual({ message: '[object Object]' });
  });

  it('createDiagnosticSink returns the Null Object when no logger is present', () => {
    expect(createDiagnosticSink(undefined)).toBe(NULL_DIAGNOSTIC_SINK);
  });

  it('NULL_DIAGNOSTIC_SINK is a branch-free no-op', () => {
    expect(() => {
      NULL_DIAGNOSTIC_SINK.internalDiag('x', new Error('y'));
      NULL_DIAGNOSTIC_SINK.cacheStaleAfterCommit('x', new Error('y'));
    }).not.toThrow();
  });
});
