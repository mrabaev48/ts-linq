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

export interface TracerLike {
  startSpan(name: string, options?: { attributes?: Record<string, unknown> }): SpanLike;
}

export interface SpanLike {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: { name: string; message: string }): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

// OTel status codes per the OpenTelemetry specification
const STATUS_OK = 1;
const STATUS_ERROR = 2;

export interface TelemetryProviderOptions {
  tracer?: TracerLike;
  maskSql?: boolean;
  maskPatterns?: ReadonlyArray<RegExp>;
}

export class TelemetryProvider implements SqlLogger {
  private readonly tracer: TracerLike | undefined;
  private readonly querySpans = new Map<string | undefined, SpanLike>();
  private readonly txSpans = new Map<string | undefined, SpanLike>();
  private readonly maskSql: boolean;
  private readonly maskPatterns: ReadonlyArray<RegExp>;

  constructor(options?: TelemetryProviderOptions) {
    this.tracer = options?.tracer;
    this.maskSql = !!options?.maskSql;
    this.maskPatterns = options?.maskPatterns ?? [];
  }

  private mask(sql: string): string {
    if (!this.maskSql) return sql;
    let s = sql
      .replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'")
      .replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
    for (const re of this.maskPatterns) {
      try {
        s = s.replace(re, '[REDACTED]');
      } catch {
        // ignore invalid regex patterns
      }
    }
    return s;
  }

  // OTel is span/trace-only — text log methods are intentional no-ops
  debug(_message: string, _meta?: Record<string, unknown>): void {}
  info(_message: string, _meta?: Record<string, unknown>): void {}
  warn(_message: string, _meta?: Record<string, unknown>): void {}
  error(_message: string, _meta?: Record<string, unknown>): void {}

  queryStart(info: QueryStartInfo): void {
    if (!this.tracer) return;
    const span = this.tracer.startSpan('db.query', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.statement': this.mask(info.sql),
        'db.parameters.count': info.params.length
      }
    });
    this.querySpans.set(info.traceId, span);
  }

  queryEnd(info: QueryEndInfo): void {
    const span = this.querySpans.get(info.traceId);
    if (!span) return;
    try {
      span.setAttribute('db.duration_ms', info.durationMs);
      if (typeof info.rows === 'number') span.setAttribute('db.rows', info.rows);
      if (info.error) {
        span.recordException({ name: info.error.name, message: info.error.message });
        span.setStatus({ code: STATUS_ERROR, message: info.error.message });
      } else {
        span.setStatus({ code: STATUS_OK });
      }
    } finally {
      span.end();
      this.querySpans.delete(info.traceId);
    }
  }

  cache(info: CacheInfo): void {
    const span = this.tracer?.startSpan('db.cache', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.cache.type': info.cache,
        'db.cache.hit': info.hit
      }
    });
    if (!span) return;
    if (typeof info.ttl === 'boolean') span.setAttribute('db.cache.ttl', info.ttl);
    span.setStatus({ code: STATUS_OK });
    span.end();
  }

  retry(info: RetryInfo): void {
    const span = this.tracer?.startSpan('db.retry', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.statement': this.mask(info.sql),
        'db.retry.attempt': info.attempt
      }
    });
    if (!span) return;
    span.end();
  }

  transactionStart(info: TransactionInfo): void {
    if (!this.tracer) return;
    const span = this.tracer.startSpan('db.transaction', {
      attributes: { 'db.system': info.provider ?? 'sql' }
    });
    this.txSpans.set(info.traceId, span);
  }

  transactionEnd(info: TransactionInfo): void {
    const span = this.txSpans.get(info.traceId);
    if (!span) return;
    try {
      span.setStatus({ code: STATUS_OK });
    } finally {
      span.end();
      this.txSpans.delete(info.traceId);
    }
  }

  connectionHealth(info: ConnectionHealthInfo): void {
    const span = this.tracer?.startSpan('db.connection.health', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.connection.healthy': info.healthy
      }
    });
    if (!span) return;
    if (typeof info.latencyMs === 'number')
      span.setAttribute('db.connection.latency_ms', info.latencyMs);
    if (info.status) span.setAttribute('db.connection.status', info.status);
    span.setStatus({ code: info.healthy ? STATUS_OK : STATUS_ERROR });
    span.end();
  }

  circuit(info: CircuitEventInfo): void {
    const span = this.tracer?.startSpan('db.circuit', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.circuit.state': info.state
      }
    });
    if (!span) return;
    if (typeof info.failures === 'number') span.setAttribute('db.circuit.failures', info.failures);
    if (info.reason) span.setAttribute('db.circuit.reason', info.reason);
    if (typeof info.halfOpenInFlight === 'number') {
      span.setAttribute('db.circuit.half_open_in_flight', info.halfOpenInFlight);
    }
    span.end();
  }

  fallback(info: FallbackInfo): void {
    const span = this.tracer?.startSpan('db.fallback', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.fallback.name': info.fallback,
        'db.fallback.attempted': info.attempted
      }
    });
    if (!span) return;
    if (typeof info.succeeded === 'boolean')
      span.setAttribute('db.fallback.succeeded', info.succeeded);
    if (info.source) span.setAttribute('db.fallback.source', info.source);
    if (typeof info.isStale === 'boolean') span.setAttribute('db.fallback.stale', info.isStale);
    if (info.error) {
      span.recordException({ name: info.error.name, message: info.error.message });
      span.setStatus({ code: STATUS_ERROR, message: info.error.message });
    } else {
      span.setStatus({ code: info.succeeded === false ? STATUS_ERROR : STATUS_OK });
    }
    span.end();
  }

  hedgedWin(info: HedgedWinInfo): void {
    const span = this.tracer?.startSpan('db.hedged', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.hedged.operation': info.operation,
        'db.hedged.winner': info.fallback
      }
    });
    if (!span) return;
    span.setStatus({ code: STATUS_OK });
    span.end();
  }

  analysis(info: QueryAnalysisInfo): void {
    const span = this.tracer?.startSpan('db.query.analysis', {
      attributes: {
        'db.system': info.provider ?? 'sql',
        'db.statement': this.mask(info.sql),
        'db.analysis.duration_ms': info.durationMs,
        'db.analysis.slow': !!info.slow,
        'db.analysis.has_explain_plan': info.explainPlan != null
      }
    });
    if (!span) return;
    if (info.recommendations?.length) {
      span.setAttribute('db.analysis.recommendations', JSON.stringify(info.recommendations));
    }
    span.end();
  }

  crossQuery(params: CrossQueryParams): void {
    const span = this.tracer?.startSpan('db.cross_query', {
      attributes: {
        'db.system': params.provider ?? 'sql',
        'db.cross_query.op': params.op,
        'db.cross_query.entity': params.entity,
        'db.cross_query.column': params.column,
        'db.cross_query.chunks': params.chunks,
        'db.cross_query.size': params.size
      }
    });
    if (!span) return;
    span.end();
  }

  cacheSize(params: CacheSizeInfo): void {
    const span = this.tracer?.startSpan('db.cache.size', {
      attributes: {
        'db.system': params.provider ?? 'sql',
        'db.cache.type': params.cache,
        'db.cache.size': params.size
      }
    });
    if (!span) return;
    span.end();
  }
}
