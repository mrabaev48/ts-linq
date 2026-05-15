import type {
  SqlLogger,
  QueryStartInfo,
  QueryEndInfo,
  CacheInfo,
  RetryInfo,
  TransactionInfo,
  ConnectionHealthInfo,
  CircuitEventInfo,
  FallbackInfo,
  HedgedWinInfo,
  QueryAnalysisInfo,
  CrossQueryParams,
  CacheSizeInfo,
} from '@ts-linq/types';

export class TelemetryProvider implements SqlLogger {
  debug(_message: string, _meta?: Record<string, unknown>): void {}
  info(_message: string, _meta?: Record<string, unknown>): void {}
  warn(_message: string, _meta?: Record<string, unknown>): void {}
  error(_message: string, _meta?: Record<string, unknown>): void {}

  cache?(_info: CacheInfo): void {}
  queryStart?(_info: QueryStartInfo): void {}
  queryEnd?(_info: QueryEndInfo): void {}
  retry?(_info: RetryInfo): void {}
  transactionStart?(_info: TransactionInfo): void {}
  transactionEnd?(_info: TransactionInfo): void {}
  connectionHealth?(_info: ConnectionHealthInfo): void {}
  circuit?(_info: CircuitEventInfo): void {}
  fallback?(_info: FallbackInfo): void {}
  hedgedWin?(_info: HedgedWinInfo): void {}
  analysis?(_info: QueryAnalysisInfo): void {}
  crossQuery?(_params: CrossQueryParams): void {}
  cacheSize?(_params: CacheSizeInfo): void {}
}
