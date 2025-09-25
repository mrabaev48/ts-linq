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
    /* ignore */
  }
  return undefined;
}

export class OpenTelemetrySqlLogger implements SqlLogger {
  private tracer:
    | { startSpan: (name: string, opts?: { attributes?: Record<string, unknown> }) => SpanLike }
    | undefined;
  private spanByTraceId: Map<string | undefined, SpanLike> = new Map();

  constructor(serviceName: string = 'ts-linq') {
    const otel = safeRequireOtel();
    this.tracer = otel?.trace.getTracer(serviceName);
  }

  queryStart(info: { sql: string; params: readonly SqlParameter[]; traceId?: string; provider?: string }): void {
    if (!this.tracer) return;
    const span = this.tracer.startSpan('db.query', {
      attributes: {
        'db.system': info.provider || 'sql',
        'db.statement': info.sql,
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
}


