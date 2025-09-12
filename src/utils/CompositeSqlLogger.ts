import type {
  SqlLogger,
  QueryStartInfo,
  QueryEndInfo,
  RetryInfo,
  TransactionInfo,
  CacheInfo
} from '../types';
import { SqlParameter } from '../types';

/**
 * Composite logger that fan-outs all SqlLogger calls to a list of delegates.
 * Each delegate is called in order; errors are swallowed to avoid impacting
 * query execution flow.
 */
export class CompositeSqlLogger implements SqlLogger {
  private readonly delegates: ReadonlyArray<SqlLogger>;

  constructor(...delegates: Array<SqlLogger | undefined | null>) {
    this.delegates = delegates.filter(Boolean) as SqlLogger[];
  }

  queryStart(info: QueryStartInfo): void {
    for (const delegate of this.delegates) {
      try {
        delegate.queryStart?.(info);
      } catch (e) {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('queryStart', e);
      }
    }
  }

  queryEnd(info: QueryEndInfo): void {
    for (const delegate of this.delegates) {
      try {
        delegate.queryEnd?.(info);
      } catch (e) {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('queryEnd', e);
      }
    }
  }

  retry(info: RetryInfo): void {
    for (const delegate of this.delegates) {
      try {
        delegate.retry?.(info);
      } catch (e) {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('retry', e);
      }
    }
  }

  transactionStart(info: TransactionInfo): void {
    for (const delegate of this.delegates) {
      try {
        delegate.transactionStart?.(info);
      } catch (e) {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('transactionStart', e);
      }
    }
  }

  transactionEnd(info: TransactionInfo): void {
    for (const delegate of this.delegates) {
      try {
        delegate.transactionEnd?.(info);
      } catch (e) {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('transactionEnd', e);
      }
    }
  }

  cache(info: CacheInfo): void {
    for (const delegate of this.delegates) {
      try {
        delegate.cache?.(info);
      } catch (e) {
        const { warnIfLoggerDebug } = require('./MetricsSafe') as {
          warnIfLoggerDebug: (method: string, error: unknown) => void;
        };
        warnIfLoggerDebug('cache', e);
      }
    }
  }
}
