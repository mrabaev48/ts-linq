"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenTelemetrySqlLogger = void 0;
function safeRequireOtel() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const otel = require('@opentelemetry/api');
        if (otel && otel.trace && typeof otel.trace.getTracer === 'function')
            return otel;
    }
    catch {
        /* ignore */
    }
    return undefined;
}
/**
 * OpenTelemetry-based SqlLogger implementation.
 * Uses dynamic require to avoid hard dependency on @opentelemetry/api.
 */
class OpenTelemetrySqlLogger {
    constructor(serviceName = 'ts-linq') {
        this.spanByTraceId = new Map();
        const otel = safeRequireOtel();
        this.tracer = otel?.trace.getTracer(serviceName);
    }
    queryStart(info) {
        if (!this.tracer)
            return;
        const span = this.tracer.startSpan('db.query', {
            attributes: {
                'db.system': info.provider || 'sql',
                'db.statement': info.sql,
                'db.parameters': JSON.stringify(info.params ?? [])
            }
        });
        this.spanByTraceId.set(info.traceId, span);
    }
    queryEnd(info) {
        const span = this.spanByTraceId.get(info.traceId);
        if (!span)
            return;
        try {
            span.setAttribute('db.duration_ms', info.durationMs);
            if (typeof info.rows === 'number')
                span.setAttribute('db.rows', info.rows);
            if (info.error) {
                span.recordException({ name: info.error.name, message: info.error.message });
                span.setStatus({ code: 2, message: info.error.message }); // 2 = ERROR
            }
            else {
                span.setStatus({ code: 1 }); // 1 = OK
            }
        }
        finally {
            span.end();
            this.spanByTraceId.delete(info.traceId);
        }
    }
}
exports.OpenTelemetrySqlLogger = OpenTelemetrySqlLogger;
//# sourceMappingURL=OpenTelemetrySqlLogger.js.map