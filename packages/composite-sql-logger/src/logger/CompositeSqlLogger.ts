import type {
  CacheInfo,
  CircuitEventInfo,
  ConnectionHealthInfo,
  FallbackInfo,
  HedgedWinInfo,
  QueryAnalysisInfo,
  QueryEndInfo,
  QueryStartInfo,
  RetryInfo,
  SqlLogger,
  TransactionInfo
} from '@ts-linq/types';

export class CompositeSqlLogger implements SqlLogger {
  private readonly delegates: ReadonlyArray<SqlLogger>;
  constructor(...delegates: Array<SqlLogger | undefined | null>) {
    this.delegates = delegates.filter(Boolean) as SqlLogger[];
  }
  debug(message: string, meta?: Record<string, unknown>): void {
    for (const d of this.delegates) {
      try {
        d.debug(message, meta);
      } catch (e) {
        console.warn('[CompositeSqlLogger] debug delegate error', e);
      }
    }
  }
  info(message: string, meta?: Record<string, unknown>): void {
    for (const d of this.delegates) {
      try {
        d.info(message, meta);
      } catch (e) {
        console.warn('[CompositeSqlLogger] info delegate error', e);
      }
    }
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    for (const d of this.delegates) {
      try {
        d.warn(message, meta);
      } catch (e) {
        console.warn('[CompositeSqlLogger] warn delegate error', e);
      }
    }
  }
  error(message: string, meta?: Record<string, unknown>): void {
    for (const d of this.delegates) {
      try {
        d.error(message, meta);
      } catch (e) {
        console.warn('[CompositeSqlLogger] error delegate error', e);
      }
    }
  }
  queryStart(info: QueryStartInfo): void {
    for (const d of this.delegates) {
      try {
        d.queryStart?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] queryStart delegate error', e);
      }
    }
  }
  queryEnd(info: QueryEndInfo): void {
    for (const d of this.delegates) {
      try {
        d.queryEnd?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] queryEnd delegate error', e);
      }
    }
  }
  retry(info: RetryInfo): void {
    for (const d of this.delegates) {
      try {
        d.retry?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] retry delegate error', e);
      }
    }
  }
  transactionStart(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionStart?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] transactionStart delegate error', e);
      }
    }
  }
  transactionEnd(info: TransactionInfo): void {
    for (const d of this.delegates) {
      try {
        d.transactionEnd?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] transactionEnd delegate error', e);
      }
    }
  }
  cache(info: CacheInfo): void {
    for (const d of this.delegates) {
      try {
        d.cache?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] cache delegate error', e);
      }
    }
  }
  connectionHealth(info: ConnectionHealthInfo): void {
    for (const d of this.delegates) {
      try {
        d.connectionHealth?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] connectionHealth delegate error', e);
      }
    }
  }
  circuit(info: CircuitEventInfo): void {
    for (const d of this.delegates) {
      try {
        d.circuit?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] circuit delegate error', e);
      }
    }
  }
  fallback(info: FallbackInfo): void {
    for (const d of this.delegates) {
      try {
        d.fallback?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] fallback delegate error', e);
      }
    }
  }
  hedgedWin(info: HedgedWinInfo): void {
    for (const d of this.delegates) {
      try {
        d.hedgedWin?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] hedgedWin delegate error', e);
      }
    }
  }
  analysis(info: QueryAnalysisInfo): void {
    for (const d of this.delegates) {
      try {
        d.analysis?.(info);
      } catch (e) {
        console.warn('[CompositeSqlLogger] analysis delegate error', e);
      }
    }
  }
}
