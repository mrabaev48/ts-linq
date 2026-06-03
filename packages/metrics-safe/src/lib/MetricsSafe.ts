import type {
  CacheInfo,
  CacheSizeInfo,
  CircuitEventInfo,
  ConnectionHealthInfo,
  CrossQueryParams,
  FallbackInfo,
  HedgedWinInfo,
  QueryAnalysisInfo,
  QueryEndInfo,
  QueryStartInfo,
  RetryInfo,
  SqlLogger,
  TransactionInfo
} from '@ts-linq/types';

function debugEnabled(): boolean {
  try {
    const env = (process as unknown as { env?: Record<string, string | undefined> }).env;
    const v = env?.TSL_METRICS_DEBUG;
    return v === '1' || v === 'true' || v === 'on';
  } catch {
    return false;
  }
}

/**
 * Internal guarded-invoke core. Optionally calls `logger[method](...args)` and never throws:
 * a missing method is a silent no-op (Null-Object), and a throwing method is swallowed —
 * surfaced via `console.warn` only when `TSL_METRICS_DEBUG` is enabled.
 *
 * Generalized from the former hard-wired `tryInvoke` (a closed `'cache' | 'cacheSize' |
 * 'cacheEvicted'` union) so any event can be safely invoked without editing a union (OCP).
 */
function invokeSafely(logger: unknown, method: string, args: readonly unknown[]): void {
  try {
    const maybeMethod = (logger as Record<string, unknown> | undefined)?.[method] as
      | ((...callArgs: readonly unknown[]) => void)
      | undefined;
    maybeMethod?.(...args);
  } catch (e) {
    if (debugEnabled()) {
      try {
        console.warn('[ts-linq metrics]', method, e);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Generic, type-safe safe-invoke primitive over the `SqlLogger` contract (DIP).
 *
 * `safeInvoke(logger, 'fallback', info)` type-checks both the method name and its arguments
 * against `SqlLogger`, then invokes it through the guarded core. Adding a new safely-invoked
 * event is done by *calling* this with another `SqlLogger` method name — no edit to any closed
 * union is required (OCP). It is a no-op when `logger` is undefined or lacks the method.
 */
export function safeInvoke<M extends keyof SqlLogger>(
  logger: SqlLogger | undefined,
  method: M,
  ...args: Parameters<NonNullable<SqlLogger[M]>>
): void {
  invokeSafely(logger, method, args);
}

/**
 * Decorator that wraps any {@link SqlLogger} so every method is guarded once: each call is
 * forwarded through the guarded core, so a throwing or missing inner method can never
 * propagate. Callers hold a `SqlLogger` that "can never throw" and need no per-call guards
 * (Decorator + Null-Object).
 */
export class SafeSqlLogger implements SqlLogger {
  private readonly inner: SqlLogger;

  constructor(inner: SqlLogger) {
    this.inner = inner;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    invokeSafely(this.inner, 'debug', [message, meta]);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    invokeSafely(this.inner, 'info', [message, meta]);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    invokeSafely(this.inner, 'warn', [message, meta]);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    invokeSafely(this.inner, 'error', [message, meta]);
  }

  cache(info: CacheInfo): void {
    invokeSafely(this.inner, 'cache', [info]);
  }

  queryStart(info: QueryStartInfo): void {
    invokeSafely(this.inner, 'queryStart', [info]);
  }

  queryEnd(info: QueryEndInfo): void {
    invokeSafely(this.inner, 'queryEnd', [info]);
  }

  retry(info: RetryInfo): void {
    invokeSafely(this.inner, 'retry', [info]);
  }

  transactionStart(info: TransactionInfo): void {
    invokeSafely(this.inner, 'transactionStart', [info]);
  }

  transactionEnd(info: TransactionInfo): void {
    invokeSafely(this.inner, 'transactionEnd', [info]);
  }

  connectionHealth(info: ConnectionHealthInfo): void {
    invokeSafely(this.inner, 'connectionHealth', [info]);
  }

  circuit(info: CircuitEventInfo): void {
    invokeSafely(this.inner, 'circuit', [info]);
  }

  fallback(info: FallbackInfo): void {
    invokeSafely(this.inner, 'fallback', [info]);
  }

  hedgedWin(info: HedgedWinInfo): void {
    invokeSafely(this.inner, 'hedgedWin', [info]);
  }

  analysis(info: QueryAnalysisInfo): void {
    invokeSafely(this.inner, 'analysis', [info]);
  }

  crossQuery(params: CrossQueryParams): void {
    invokeSafely(this.inner, 'crossQuery', [params]);
  }

  cacheSize(params: CacheSizeInfo): void {
    invokeSafely(this.inner, 'cacheSize', [params]);
  }
}

export function safeCache(
  logger: unknown,
  payload: {
    cache: 'sqlGen' | 'entityL2' | 'count';
    hit: boolean;
    provider?: string;
    ttl?: boolean;
  }
): void {
  invokeSafely(logger, 'cache', [payload]);
}

export function safeCacheSize(
  logger: unknown,
  payload: { cache: 'sqlGen' | 'entityL2' | 'count'; size: number; provider?: string }
): void {
  invokeSafely(logger, 'cacheSize', [payload]);
}

export function safeCacheEvicted(
  logger: unknown,
  payload: { cache: 'sqlGen' | 'entityL2' | 'count'; provider?: string }
): void {
  invokeSafely(logger, 'cacheEvicted', [payload]);
}

export function warnIfLoggerDebug(method: string, error: unknown): void {
  try {
    const env = (process as unknown as { env?: Record<string, string | undefined> }).env;
    const debug = env?.TSL_LOGGER_DEBUG;
    if (debug === '1' || debug === 'true' || debug === 'on') {
      console.warn('[ts-linq logger]', method, error);
    }
  } catch {
    /* ignore */
  }
}
