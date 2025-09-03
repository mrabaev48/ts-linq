import { SqlLogger } from '../types';

/**
 * OpenTelemetry-based SqlLogger implementation.
 * Uses dynamic require to avoid hard dependency on @opentelemetry/api.
 */
export class OpenTelemetrySqlLogger implements SqlLogger {
  private tracer: any;
  private spanByTraceId: Map<string | undefined, any> = new Map();

  constructor(serviceName: string = 'ts-linq') {
    try {
      const otel = require('@opentelemetry/api');
      this.tracer = otel.trace.getTracer(serviceName);
    } catch {
      this.tracer = undefined;
    }
  }

  queryStart(info: { sql: string; params: any[]; traceId?: string }): void {
    if (!this.tracer) return;
    const span = this.tracer.startSpan('db.query', {
      attributes: {
        'db.system': 'sql',
        'db.statement': info.sql,
        'db.parameters': JSON.stringify(info.params ?? [])
      }
    });
    this.spanByTraceId.set(info.traceId, span);
  }

  queryEnd(info: {
    sql: string;
    params: any[];
    durationMs: number;
    traceId?: string;
    rows?: number;
    error?: Error;
  }): void {
    const span = this.spanByTraceId.get(info.traceId);
    if (!span) return;
    try {
      span.setAttribute('db.duration_ms', info.durationMs);
      if (typeof info.rows === 'number') span.setAttribute('db.rows', info.rows);
      if (info.error) {
        span.recordException({ name: info.error.name, message: info.error.message });
        span.setStatus({ code: 2, message: info.error.message }); // 2 = ERROR
      } else {
        span.setStatus({ code: 1 }); // 1 = OK
      }
    } finally {
      span.end();
      this.spanByTraceId.delete(info.traceId);
    }
  }
}
