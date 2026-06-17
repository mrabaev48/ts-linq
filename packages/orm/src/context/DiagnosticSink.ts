import type { SqlLogger } from '@ts-linq/types';

/**
 * Severity for a swallowed, non-fatal diagnostic on a best-effort path.
 *
 * - `debug` — valid recovery (warm-up, optional pre-warm): expected to fail
 *   sometimes; surfaced only when the host opts into debug-level logging.
 * - `warn`  — log-and-continue / cleanup-with-swallow: a real failure on a path
 *   that must not abort the caller (metrics, dispose, rollback bookkeeping).
 */
export type DiagnosticLevel = 'debug' | 'warn';

/**
 * Single internal diagnostics seam for the ORM's swallow paths.
 *
 * Every `catch` that intentionally does not rethrow routes through this sink
 * instead of dropping the error silently. The abstraction (dependency
 * inversion) keeps the call sites free of a concrete logger and lets tests
 * observe the emitted diagnostics; the {@link NULL_DIAGNOSTIC_SINK} Null Object
 * keeps those call sites branch-free when no logger is configured.
 *
 * @internal Not part of the public `@ts-linq/orm` surface.
 */
export interface DiagnosticSink {
  /**
   * Report a swallowed, non-fatal error on a best-effort/cleanup path. The
   * `label` is a stable operation identifier (e.g.
   * `'DbContext.cache.reportMetrics'`) used to discriminate the source.
   */
  internalDiag(label: string, error: unknown, level?: DiagnosticLevel): void;
  /**
   * Report that **post-commit cache invalidation failed**: the provider commit
   * already succeeded, so the cache may now be stale and subsequent queries can
   * return wrong results. Emitted as an observable, structured warning so
   * callers/hosts can detect the potential staleness.
   */
  cacheStaleAfterCommit(label: string, error: unknown): void;
}

/** Reduce an unknown thrown value to a safe-to-log shape (no secrets/PII). */
function describe(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

/**
 * Default sink: routes diagnostics through the provider's internal
 * {@link SqlLogger} (`provider.loggerRef`). Stays silent unless the host has
 * configured logging, mirroring the library's no-console policy.
 */
class LoggerDiagnosticSink implements DiagnosticSink {
  constructor(private readonly logger: SqlLogger) {}

  internalDiag(label: string, error: unknown, level: DiagnosticLevel = 'warn'): void {
    const meta = { label, error: describe(error) };
    if (level === 'debug') {
      this.logger.debug(`[ts-linq] ${label}`, meta);
    } else {
      this.logger.warn(`[ts-linq] ${label}`, meta);
    }
  }

  cacheStaleAfterCommit(label: string, error: unknown): void {
    this.logger.warn(`[ts-linq] cache may be stale after commit: ${label}`, {
      label,
      staleCache: true,
      error: describe(error)
    });
  }
}

/**
 * Null Object sink — used when diagnostics are disabled or no logger is
 * attached. All methods are no-ops so the catch sites can call the sink
 * unconditionally (no `if (logger)` guards).
 *
 * @internal
 */
export const NULL_DIAGNOSTIC_SINK: DiagnosticSink = {
  internalDiag(): void {},
  cacheStaleAfterCommit(): void {}
};

/**
 * Build the diagnostics sink for a context. Returns the {@link NULL_DIAGNOSTIC_SINK}
 * Null Object when no internal logger is available, otherwise a logger-backed
 * sink.
 *
 * @internal
 */
export function createDiagnosticSink(logger: SqlLogger | undefined): DiagnosticSink {
  return logger ? new LoggerDiagnosticSink(logger) : NULL_DIAGNOSTIC_SINK;
}
