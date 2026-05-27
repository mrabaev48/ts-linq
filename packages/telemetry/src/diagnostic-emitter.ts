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

  cache(_info: CacheInfo): void {
    /* cache events are not forwarded to the text sink by default */
  }

  connectionHealth(_info: ConnectionHealthInfo): void {
    /* connection health events are not forwarded to the text sink by default */
  }

  circuit(_info: CircuitEventInfo): void {
    /* circuit events are not forwarded to the text sink by default */
  }

  fallback(_info: FallbackInfo): void {
    /* fallback events are not forwarded to the text sink by default */
  }

  hedgedWin(_info: HedgedWinInfo): void {
    /* hedged-win events are not forwarded to the text sink by default */
  }

  analysis(_info: QueryAnalysisInfo): void {
    /* analysis events are not forwarded to the text sink by default */
  }

  crossQuery(_params: CrossQueryParams): void {
    /* cross-query events are not forwarded to the text sink by default */
  }

  cacheSize(_params: CacheSizeInfo): void {
    /* cache-size events are not forwarded to the text sink by default */
  }
}
