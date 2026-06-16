import type {
  CacheInfo,
  CacheSizeInfo,
  CircuitEventInfo,
  ConnectionHealthInfo,
  CrossQueryParams,
  DiagnosticConfig,
  FallbackInfo,
  HedgedWinInfo,
  LogLevel,
  QueryAnalysisInfo,
  QueryEndInfo,
  QueryStartInfo,
  RetryInfo,
  SqlLogger,
  TransactionInfo,
  WarningBehavior
} from '@ts-linq/types';

import { maskParams } from './parameter-masker';
import { EfWarningError } from './warning-router';

const LEVELS: LogLevel[] = [
  'trace',
  'debug',
  'information',
  'warning',
  'error',
  'critical',
  'none'
];

/**
 * SqlLogger implementation that sits between the pipeline and the user's log sink.
 * It applies parameter masking, log-level filtering, and warning escalation.
 *
 * Created automatically by DbContext when DbContextOptionsBuilder.logTo() is called.
 */
export class DiagnosticEmitter implements SqlLogger {
  private readonly sink: (message: string) => void;
  private readonly minLevel: LogLevel;
  private readonly sensitiveData: boolean;
  private readonly detailedErrors: boolean;
  private readonly routes: ReadonlyMap<string, WarningBehavior>;

  constructor(config: DiagnosticConfig) {
    this.sink =
      config.sink ??
      (() => {
        /* no-op */
      });
    this.minLevel = config.level ?? 'information';
    this.sensitiveData = config.sensitiveDataEnabled ?? false;
    this.detailedErrors = config.detailedErrors ?? false;
    this.routes = config.warningRoutes ?? new Map<string, WarningBehavior>();
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.minLevel);
  }

  private route(eventId: string, level: LogLevel, message: string): void {
    const behavior = this.routes.get(eventId) as WarningBehavior | undefined;
    if (behavior === 'suppress') return;
    if (behavior === 'throw') throw new EfWarningError(eventId, message);
    // 'log' behavior forces output regardless of the configured minimum level
    if (behavior === 'log' || this.shouldLog(level)) this.sink(message);
  }

  // ── Logger text methods ───────────────────────────────────────────────────

  debug(message: string, _meta?: Record<string, unknown>): void {
    this.route('', 'debug', message);
  }

  info(message: string, _meta?: Record<string, unknown>): void {
    this.route('', 'information', message);
  }

  warn(message: string, _meta?: Record<string, unknown>): void {
    this.route('', 'warning', message);
  }

  error(message: string, _meta?: Record<string, unknown>): void {
    this.route('', 'error', message);
  }

  // ── SqlLogger event methods ───────────────────────────────────────────────

  queryStart(info: QueryStartInfo): void {
    const params = this.sensitiveData ? info.params : maskParams(info.params);
    this.route(
      'core.query-start',
      'debug',
      `Executing SQL: ${info.sql} -- params: [${params.join(', ')}]`
    );
  }

  queryEnd(info: QueryEndInfo): void {
    if (info.error) {
      const stack = this.detailedErrors && info.error.stack ? `\n${info.error.stack}` : '';
      this.route(
        'core.query-error',
        'error',
        `Query failed (${info.durationMs}ms): ${info.error.message}${stack}`
      );
    } else {
      const rows = info.rows != null ? ` — ${info.rows} rows` : '';
      this.route('core.query-end', 'debug', `Query OK (${info.durationMs}ms)${rows}`);
    }
  }

  retry(info: RetryInfo): void {
    this.route('core.retry', 'warning', `Retry attempt #${info.attempt}: ${info.sql}`);
  }

  transactionStart(_info: TransactionInfo): void {
    this.route('core.transaction-start', 'debug', 'Transaction started');
  }

  transactionEnd(_info: TransactionInfo): void {
    this.route('core.transaction-end', 'debug', 'Transaction ended');
  }

  cache(info: CacheInfo): void {
    this.route('core.cache', 'trace', `Cache ${info.hit ? 'hit' : 'miss'} [${info.cache}]`);
  }

  connectionHealth(info: ConnectionHealthInfo): void {
    const level = info.healthy ? 'debug' : 'warning';
    const lat = info.latencyMs != null ? ` (${info.latencyMs}ms)` : '';
    this.route(
      'core.connection-health',
      level,
      `Connection ${info.healthy ? 'healthy' : 'unhealthy'}${lat}`
    );
  }

  circuit(info: CircuitEventInfo): void {
    const reason = info.reason ? ` — ${info.reason}` : '';
    this.route(
      'core.circuit-open',
      'warning',
      `Circuit ${info.state}${reason} (failures: ${info.failures ?? 0})`
    );
  }

  fallback(info: FallbackInfo): void {
    const level = info.succeeded === false ? 'error' : 'warning';
    const stale = info.isStale ? ' [stale]' : '';
    this.route(
      'core.fallback',
      level,
      `Fallback "${info.fallback}"${stale}: ${info.succeeded ? 'succeeded' : 'failed'}`
    );
  }

  hedgedWin(info: HedgedWinInfo): void {
    this.route(
      'core.hedged-win',
      'debug',
      `Hedged win: "${info.fallback}" won operation "${info.operation}"`
    );
  }

  analysis(info: QueryAnalysisInfo): void {
    const slow = info.slow ? ' [SLOW]' : '';
    this.route(
      'core.analysis',
      'debug',
      `Query analysis${slow} (${info.durationMs}ms): ${info.sql}`
    );
  }

  crossQuery(params: CrossQueryParams): void {
    this.route(
      'relational.cross-query-chunk',
      'debug',
      `Cross-query ${params.op} on ${params.entity}.${params.column}: ${params.chunks} chunks, size=${params.size}`
    );
  }

  cacheSize(params: CacheSizeInfo): void {
    this.route('core.cache-size', 'trace', `Cache size [${params.cache}]: ${params.size}`);
  }
}
