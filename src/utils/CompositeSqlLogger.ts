import { SqlLogger, SqlParameter, QueryStartInfo, QueryEndInfo, RetryInfo, TransactionInfo, CacheInfo } from '../types';

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
    for (const d of this.delegates) {
      try {
        d.queryStart?.(info);
      } catch {
        /* ignore delegate errors */
      }
    }
  }

  queryEnd(info: QueryEndInfo): void {
    for (const d of this.delegates) {
      try {
        d.queryEnd?.(info);
      } catch {
        /* ignore delegate errors */
      }
    }
  }

  retry(info: RetryInfo): void {
    for (const d of this.delegates) {
      try {
        d.retry?.(info);
      } catch {
        /* ignore delegate errors */
      }
    }
  }

  transactionStart(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionStart?.(info);
      } catch {
        /* ignore delegate errors */
      }
    }
  }

  transactionEnd(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionEnd?.(info);
      } catch {
        /* ignore delegate errors */
      }
    }
  }

  cache(info: CacheInfo): void {
    for (const d of this.delegates) {
      try {
        d.cache?.(info);
      } catch {
        /* ignore delegate errors */
      }
    }
  }
}
