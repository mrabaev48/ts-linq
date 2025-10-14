import type {
  SqlLogger,
  QueryStartInfo,
  QueryEndInfo,
  RetryInfo,
  TransactionInfo,
  CacheInfo,
  CircuitEventInfo,
  ConnectionHealthInfo,
  FallbackInfo
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
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] queryStart delegate error', e);
      }
    }
  }
  queryEnd(info: QueryEndInfo): void {
    for (const d of this.delegates) {
      try {
        d.queryEnd?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] queryEnd delegate error', e);
      }
    }
  }
  retry(info: RetryInfo): void {
    for (const d of this.delegates) {
      try {
        d.retry?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] retry delegate error', e);
      }
    }
  }
  transactionStart(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionStart?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] transactionStart delegate error', e);
      }
    }
  }
  transactionEnd(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionEnd?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] transactionEnd delegate error', e);
      }
    }
  }
  cache(info: CacheInfo): void {
    for (const d of this.delegates) {
      try {
        d.cache?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] cache delegate error', e);
      }
    }
  }
  connectionHealth(info: ConnectionHealthInfo): void {
    for (const d of this.delegates) {
      try {
        d.connectionHealth?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] connectionHealth delegate error', e);
      }
    }
  }
  circuit(info: CircuitEventInfo): void {
    for (const d of this.delegates) {
      try {
        d.circuit?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] circuit delegate error', e);
      }
    }
  }
  fallback(info: FallbackInfo): void {
    for (const d of this.delegates) {
      try {
        d.fallback?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] fallback delegate error', e);
      }
    }
  }
  hedgedWin(info: { provider?: string; operation: string; fallback: string }): void {
    for (const d of this.delegates) {
      try {
        (
          d as unknown as {
            hedgedWin?: (i: { provider?: string; operation: string; fallback: string }) => void;
          }
        ).hedgedWin?.(info);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CompositeSqlLogger] hedgedWin delegate error', e);
      }
    }
  }
}
