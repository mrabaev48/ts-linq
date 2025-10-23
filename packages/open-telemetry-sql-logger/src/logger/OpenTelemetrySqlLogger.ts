import type { SqlLogger, SqlParameter } from '@ts-linq/core';

interface OtelLike {
  trace: {
    getTracer: (serviceName: string) => {
      startSpan: (name: string, opts?: { attributes?: Record<string, unknown> }) => SpanLike;
    };
  };
}
interface SpanLike {
  setAttribute: (key: string, value: unknown) => void;
  recordException: (err: { name: string; message: string }) => void;
  setStatus: (status: { code: number; message?: string }) => void;
  end: () => void;
}

function safeRequireOtel(): OtelLike | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const otel = require('@opentelemetry/api') as OtelLike;
    if (otel && otel.trace && typeof otel.trace.getTracer === 'function') return otel;
  } catch {
    // Silently fail if OpenTelemetry is not installed
  }
  return undefined;
}

export interface OpenTelemetryLoggerOptions {
  maskSql?: boolean;
  maskPatterns?: ReadonlyArray<RegExp>;
}

export class OpenTelemetrySqlLogger implements SqlLogger {
  private tracer:
    | { startSpan: (name: string, opts?: { attributes?: Record<string, unknown> }) => SpanLike }
    | undefined;
  private spanByTraceId: Map<string | undefined, SpanLike> = new Map();
  private maskSql = false;
  private maskPatterns: ReadonlyArray<RegExp> = [];

  constructor(serviceName: string = 'ts-linq', options?: OpenTelemetryLoggerOptions) {
    const otel = safeRequireOtel();
    this.tracer = otel?.trace.getTracer(serviceName);
    this.maskSql = !!options?.maskSql;
    this.maskPatterns = options?.maskPatterns ?? [];
  }

  private mask(input: string): string {
    if (!this.maskSql) return input;
    let s = input;
    // redact single- and double-quoted strings using safe regexps (no unmatched groups)
    s = s.replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'").replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
    for (const re of this.maskPatterns) {
      try {
        s = s.replace(re, '[REDACTED]');
      } catch {
        // Ignore regex errors
      }
    }
    return s;
  }

  public debug(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: OpenTelemetry doesn't log text messages directly
  }
  public info(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: OpenTelemetry doesn't log text messages directly
  }
  public warn(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: OpenTelemetry doesn't log text messages directly
  }
  public error(_message: string, _meta?: Record<string, unknown>): void {
    // No-op: OpenTelemetry doesn't log text messages directly
  }

  queryStart(info: {
    sql: string;
    params: readonly SqlParameter[];
    traceId?: string;
    provider?: string;
  }): void {
    if (!this.tracer) return;
    const span = this.tracer.startSpan('db.query', {
      attributes: {
        'db.system': info.provider || 'sql',
        'db.statement': this.mask(info.sql),
        'db.parameters': JSON.stringify(info.params ?? [])
      }
    });
    this.spanByTraceId.set(info.traceId, span);
  }

  queryEnd(info: {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    traceId?: string;
    rows?: number;
    error?: Error;
    provider?: string;
  }): void {
    const span = this.spanByTraceId.get(info.traceId);
    if (!span) return;
    try {
      span.setAttribute('db.duration_ms', info.durationMs);
      if (typeof info.rows === 'number') span.setAttribute('db.rows', info.rows);
      if (info.error) {
        span.recordException({ name: info.error.name, message: info.error.message });
        span.setStatus({ code: 2, message: info.error.message });
      } else {
        span.setStatus({ code: 1 });
      }
    } finally {
      span.end();
      this.spanByTraceId.delete(info.traceId);
    }
  }

  analysis?(info: {
    sql: string;
    params: readonly SqlParameter[];
    durationMs: number;
    provider?: string;
    slow?: boolean;
    explainPlan?: unknown;
    recommendations?: ReadonlyArray<string>;
  }): void {
    try {
      const span = this.tracer?.startSpan('db.query.analysis', {
        attributes: {
          'db.system': info.provider || 'sql',
          'db.analysis.duration_ms': info.durationMs,
          'db.analysis.slow': !!info.slow,
          'db.analysis.explain': info.explainPlan ? 'true' : 'false'
        }
      });
      if (!span) return;
      if (info.recommendations && info.recommendations.length > 0) {
        span.setAttribute('db.analysis.recommendations', JSON.stringify(info.recommendations));
      }
      // Do not attach SQL text here to avoid duplication and sensitive data; rely on db.statement in query span
      span.end();
    } catch {
      // Ignore errors in analysis
    }
  }
}
