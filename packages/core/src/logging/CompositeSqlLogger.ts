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

import { logInternalError } from '../utils/InternalLogger';

/**
 * Composite {@link SqlLogger} (Composite pattern) that fans every event out to a
 * list of delegate loggers.
 *
 * Replaces the former `DatabaseProvider.mergeLoggers` static: each delegate
 * dispatch is isolated, so a throw in one logger never prevents the others from
 * receiving the event and never propagates to the caller. Failures are surfaced
 * (not silently dropped) through the single {@link logInternalError} telemetry
 * boundary.
 *
 * Nested composites are flattened on construction so repeated
 * {@link DatabaseProvider.attachLogger} calls do not build a deep delegate tree.
 *
 * This collaborator is internal to `@ts-linq/core`; it is intentionally not part
 * of the package's public surface (a separate, consumer-facing fan-out logger
 * lives in `@ts-linq/composite-sql-logger`).
 */
export class CompositeSqlLogger implements SqlLogger {
  private readonly delegates: ReadonlyArray<SqlLogger>;

  constructor(...delegates: ReadonlyArray<SqlLogger | undefined | null>) {
    const flat: SqlLogger[] = [];
    for (const delegate of delegates) {
      if (!delegate) continue;
      if (delegate instanceof CompositeSqlLogger) {
        flat.push(...delegate.delegates);
      } else {
        flat.push(delegate);
      }
    }
    this.delegates = flat;
  }

  /** Dispatch one event to every delegate, isolating each delegate's failures. */
  private dispatch(method: string, invoke: (delegate: SqlLogger) => void): void {
    for (const delegate of this.delegates) {
      try {
        invoke(delegate);
      } catch (e) {
        logInternalError(`CompositeSqlLogger.${method}`, e);
      }
    }
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.dispatch('debug', (d) => d.debug(message, meta));
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.dispatch('info', (d) => d.info(message, meta));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.dispatch('warn', (d) => d.warn(message, meta));
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.dispatch('error', (d) => d.error(message, meta));
  }

  public cache(info: CacheInfo): void {
    this.dispatch('cache', (d) => d.cache?.(info));
  }

  public queryStart(info: QueryStartInfo): void {
    this.dispatch('queryStart', (d) => d.queryStart?.(info));
  }

  public queryEnd(info: QueryEndInfo): void {
    this.dispatch('queryEnd', (d) => d.queryEnd?.(info));
  }

  public retry(info: RetryInfo): void {
    this.dispatch('retry', (d) => d.retry?.(info));
  }

  public transactionStart(info: TransactionInfo): void {
    this.dispatch('transactionStart', (d) => d.transactionStart?.(info));
  }

  public transactionEnd(info: TransactionInfo): void {
    this.dispatch('transactionEnd', (d) => d.transactionEnd?.(info));
  }

  public connectionHealth(info: ConnectionHealthInfo): void {
    this.dispatch('connectionHealth', (d) => d.connectionHealth?.(info));
  }

  public circuit(info: CircuitEventInfo): void {
    this.dispatch('circuit', (d) => d.circuit?.(info));
  }

  public fallback(info: FallbackInfo): void {
    this.dispatch('fallback', (d) => d.fallback?.(info));
  }

  public hedgedWin(info: HedgedWinInfo): void {
    this.dispatch('hedgedWin', (d) => d.hedgedWin?.(info));
  }

  public analysis(info: QueryAnalysisInfo): void {
    this.dispatch('analysis', (d) => d.analysis?.(info));
  }

  public crossQuery(params: CrossQueryParams): void {
    this.dispatch('crossQuery', (d) => d.crossQuery?.(params));
  }

  public cacheSize(params: CacheSizeInfo): void {
    this.dispatch('cacheSize', (d) => d.cacheSize?.(params));
  }
}
