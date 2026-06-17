/**
 * Error-path regression suite for the silent/commented-out catch reclassification
 * (refactor orm/task-2).
 *
 * Each previously-swallowed catch must now route through the injected
 * DiagnosticSink: the operation completes (no rethrow on the swallow paths) AND a
 * diagnostic is observable on the provider's logger. The post-commit cache
 * invalidation failure additionally surfaces a structured staleness warning.
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { MemoryProfilerLike } from '@ts-linq/core';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import type { SqlLogger } from '@ts-linq/types';

import type { DbContextServices } from '../src/context/DbContextServices';
import { createDiagnosticSink } from '../src/context/DiagnosticSink';
import { TransactionScope } from '../src/context/TransactionScope';
import { DbContext } from '../src/DbContext';
import { TestProvider } from '../tests/stubs/TestProvider';

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

function byLabel(calls: Capture[], label: string): Capture | undefined {
  return calls.find((c) => c.meta?.label === label);
}

@Entity({ name: 'diag_widgets' })
class Widget {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class WidgetContext extends DbContext {
  widgets = this.set(Widget);
}

describe('orm/task-2 — silent catch reclassification routes through DiagnosticSink', () => {
  describe('TransactionScope (commit / rollback paths)', () => {
    function makeScope(opts: { invalidateThrows?: boolean; sizeThrows?: boolean }) {
      const { logger, calls } = makeCapturingLogger();
      const provider = {
        beginTransaction: async () => undefined,
        commitTransaction: async () => undefined,
        rollbackTransaction: async () => undefined,
        loggerRef: logger,
        providerLabel: 'test'
      };
      const cacheCoordinator = {
        invalidateOnCommit: () => {
          if (opts.invalidateThrows) throw new Error('invalidate boom');
        },
        clearAll: () => undefined
      };
      const entityCache = opts.sizeThrows
        ? {
            size: () => {
              throw new Error('size boom');
            }
          }
        : undefined;
      const services = {
        provider,
        cacheCoordinator,
        entityCache,
        diagnosticSink: createDiagnosticSink(logger)
      } as unknown as DbContextServices;
      return { scope: new TransactionScope(services), calls };
    }

    it('post-commit invalidation failure: commit still completes AND a staleness warning is observable', async () => {
      const { scope, calls } = makeScope({ invalidateThrows: true });
      await scope.begin();

      await expect(scope.commit()).resolves.toBeUndefined();
      expect(scope.isActive).toBe(false);

      const diag = byLabel(calls, 'DbContext.commitTransaction.invalidateCaches');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warn');
      expect(diag?.meta?.staleCache).toBe(true);
    });

    it('rollback entity-cache readout failure is logged and continues', async () => {
      const { scope, calls } = makeScope({ sizeThrows: true });
      await scope.begin();

      await expect(scope.rollback()).resolves.toBeUndefined();
      expect(scope.isActive).toBe(false);

      const diag = byLabel(calls, 'DbContext.rollbackTransaction.entityCacheClear');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warn');
    });
  });

  describe('DbContext (cache / dispose paths)', () => {
    let provider: TestProvider;
    let calls: Capture[];

    beforeEach(async () => {
      provider = new TestProvider(':memory:');
      const cap = makeCapturingLogger();
      calls = cap.calls;
      // Attach the capturing logger BEFORE constructing the context so the
      // bootstrapper builds the sink from it (provider.loggerRef).
      provider.attachLogger(cap.logger);
      await provider.connect();
    });

    afterEach(async () => {
      await provider?.disconnect?.();
    });

    it('warmUp: a rejecting task is logged at debug and the batch still resolves', async () => {
      const ctx = new WidgetContext({ provider });
      await ctx.ensureCreated();

      await expect(
        ctx.cache.warmUp({
          queries: [() => Promise.reject(new Error('warmup boom')), () => Promise.resolve(1)]
        })
      ).resolves.toBeUndefined();

      const diag = byLabel(calls, 'DbContext.cache.warmUp.task');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('debug');
    });

    it('reportMetrics: a throwing metrics readout is logged and does not break the path', async () => {
      const ctx = new WidgetContext({ provider });
      await ctx.ensureCreated();
      const services = (ctx as unknown as { _services: DbContextServices })._services;
      const owned = services.ownedSqlCache as unknown as { getMetrics: () => unknown };
      owned.getMetrics = () => {
        throw new Error('metrics boom');
      };

      expect(() => ctx.cache.reportMetrics()).not.toThrow();

      const diag = byLabel(calls, 'DbContext.cache.reportMetrics');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warn');
    });

    it('dispose: a throwing profiler stop is logged at warn and dispose completes', async () => {
      const profiler: MemoryProfilerLike = {
        onSample: () => () => undefined,
        start: () => undefined,
        stop: () => {
          throw new Error('stop boom');
        }
      };
      const ctx = new WidgetContext({ provider, diagnostics: { memoryProfiler: profiler } });
      await ctx.ensureCreated();

      await expect(ctx.dispose()).resolves.toBeUndefined();

      const diag = byLabel(calls, 'DbContext.dispose.memoryProfiler.stop');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warn');
    });
  });

  describe('DbSet (count-cache invalidation path)', () => {
    it('invalidateCountCache: a throwing invalidateBy is logged, not silently swallowed', async () => {
      const provider = new TestProvider(':memory:');
      const cap = makeCapturingLogger();
      provider.attachLogger(cap.logger);
      await provider.connect();

      const countCache = {
        invalidateBy: () => {
          throw new Error('invalidateBy boom');
        },
        getMetrics: () => undefined
      };
      const ctx = new WidgetContext({
        provider,
        performance: { countCache: countCache as never }
      });
      await ctx.ensureCreated();

      const set = ctx.set(Widget) as unknown as { invalidateCountCache: () => void };
      expect(() => set.invalidateCountCache()).not.toThrow();

      const diag = byLabel(cap.calls, 'DbSet.invalidateCountCache');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warn');

      await provider.disconnect();
    });
  });

  describe('end-to-end commit staleness (real CacheCoordinator wiring)', () => {
    it('a throwing L2 entityCache.clear() during commit surfaces an observable staleness warning', async () => {
      const provider = new TestProvider(':memory:');
      const cap = makeCapturingLogger();
      provider.attachLogger(cap.logger);
      await provider.connect();

      // Minimal L2 entity cache whose clear() throws — exercising the real
      // CacheCoordinator.invalidateOnCommit path (which no longer self-swallows).
      const entityCache = {
        clear: () => {
          throw new Error('clear boom');
        },
        size: () => 0,
        get: () => undefined,
        set: () => undefined,
        remove: () => undefined
      };
      const ctx = new WidgetContext({
        provider,
        performance: { enableEntityCache: true, entityCache: entityCache as never }
      });
      await ctx.ensureCreated();

      await ctx.beginTransaction();
      await expect(ctx.commitTransaction()).resolves.toBeUndefined();
      expect(ctx.isInTransaction).toBe(false);

      const diag = byLabel(cap.calls, 'DbContext.commitTransaction.invalidateCaches');
      expect(diag).toBeDefined();
      expect(diag?.level).toBe('warn');
      expect(diag?.meta?.staleCache).toBe(true);

      await ctx.dispose();
    });
  });
});
