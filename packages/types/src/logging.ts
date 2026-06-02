// Логирование и события базы данных

import type { SqlParameter } from './sql';

// Logger interface
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// Logger info types for SqlLogger methods
export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface QueryStartInfo {
  sql: string;
  params: readonly SqlParameter[];
  traceId?: string;
  provider?: string;
  /** True when the query was executed via a CapturedQueryPlan (compiled query). */
  compiledPlan?: boolean;
}

export interface QueryEndInfo {
  sql: string;
  params: readonly SqlParameter[];
  durationMs: number;
  traceId?: string;
  rows?: number;
  error?: Error;
  provider?: string;
}

export interface RetryInfo {
  sql: string;
  params: readonly SqlParameter[];
  attempt: number;
  traceId?: string;
  provider?: string;
}

export interface TransactionInfo {
  traceId?: string;
  provider?: string;
}

export interface CacheInfo {
  cache: 'sqlGen' | 'entityL2' | 'count';
  hit: boolean;
  provider?: string;
  ttl?: boolean;
}

export interface ConnectionHealthInfo {
  healthy: boolean;
  latencyMs?: number;
  provider?: string;
  status?: ConnectionHealthStatus;
}

export interface CircuitEventInfo {
  state: CircuitState;
  provider?: string;
  failures?: number;
  reason?: string;
  halfOpenInFlight?: number;
}

export interface FallbackInfo {
  provider?: string;
  fallback: string;
  attempted: boolean;
  succeeded?: boolean;
  error?: Error;
  throttled?: boolean;
  isStale?: boolean;
  asOf?: number;
  source?: string;
}

export interface HedgedWinInfo {
  provider?: string;
  operation: string;
  fallback: string;
}

export interface QueryAnalysisInfo {
  sql: string;
  params: readonly SqlParameter[];
  durationMs: number;
  provider?: string;
  slow?: boolean;
  explainPlan?: unknown;
  recommendations?: ReadonlyArray<string>;
}

// Cross-query chunk logging params
export interface CrossQueryParams {
  op: 'IN-chunk';
  chunks: number;
  size: number;
  entity: string;
  column: string;
  provider?: string;
}

// Cache size reporting params
export interface CacheSizeInfo {
  cache: 'sqlGen' | 'count' | 'entityL2';
  size: number;
  provider?: string;
}

// SqlLogger extends Logger with additional methods for database event logging
export interface SqlLogger extends Logger {
  cache?(info: CacheInfo): void;
  queryStart?(info: QueryStartInfo): void;
  queryEnd?(info: QueryEndInfo): void;
  retry?(info: RetryInfo): void;
  transactionStart?(info: TransactionInfo): void;
  transactionEnd?(info: TransactionInfo): void;
  connectionHealth?(info: ConnectionHealthInfo): void;
  circuit?(info: CircuitEventInfo): void;
  fallback?(info: FallbackInfo): void;
  hedgedWin?(info: HedgedWinInfo): void;
  analysis?(info: QueryAnalysisInfo): void;
  crossQuery?(params: CrossQueryParams): void;
  cacheSize?(params: CacheSizeInfo): void;
}

// SqlLoggerFactory for creating dialect-specific loggers
export interface SqlLoggerFactory {
  create(provider: 'mysql' | 'postgresql' | 'mssql' | string): SqlLogger | undefined;
}
