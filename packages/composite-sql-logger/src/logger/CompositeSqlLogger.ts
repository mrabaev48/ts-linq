import type {
  SqlLogger,
  QueryStartInfo,
  QueryEndInfo,
  RetryInfo,
  TransactionInfo,
  CacheInfo,
  CircuitEventInfo
} from '@ts-linq/core';

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
        /* swallow */
      }
    }
  }
  queryEnd(info: QueryEndInfo): void {
    for (const d of this.delegates) {
      try {
        d.queryEnd?.(info);
      } catch {
        /* swallow */
      }
    }
  }
  retry(info: RetryInfo): void {
    for (const d of this.delegates) {
      try {
        d.retry?.(info);
      } catch {
        /* swallow */
      }
    }
  }
  transactionStart(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionStart?.(info);
      } catch {
        /* swallow */
      }
    }
  }
  transactionEnd(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionEnd?.(info);
      } catch {
        /* swallow */
      }
    }
  }
  cache(info: CacheInfo): void {
    for (const d of this.delegates) {
      try {
        d.cache?.(info);
      } catch {
        /* swallow */
      }
    }
  }
  circuit(info: CircuitEventInfo): void {
    for (const d of this.delegates) {
      try {
        d.circuit?.(info);
      } catch {
        /* swallow */
      }
    }
  }
}
