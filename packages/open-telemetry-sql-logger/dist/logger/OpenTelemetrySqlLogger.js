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
class OpenTelemetrySqlLogger {
    constructor(serviceName = 'ts-linq', options) {
        this.spanByTraceId = new Map();
        this.maskSql = false;
        this.maskPatterns = [];
        const otel = safeRequireOtel();
        this.tracer = otel?.trace.getTracer(serviceName);
        this.maskSql = !!options?.maskSql;
        this.maskPatterns = options?.maskPatterns ?? [];
    }
    mask(input) {
        if (!this.maskSql)
            return input;
        let s = input;
        // redact single- and double-quoted strings using safe regexps (no unmatched groups)
        s = s
            .replace(/'(?:[^']|''+)*'/g, "'[REDACTED]'")
            .replace(/"(?:[^"\\]|\\.)*"/g, '"[REDACTED]"');
        for (const re of this.maskPatterns) {
            try {
                s = s.replace(re, '[REDACTED]');
            }
            catch { }
        }
        return s;
    }
    queryStart(info) {
        if (!this.tracer)
            return;
        const span = this.tracer.startSpan('db.query', {
            attributes: {
                'db.system': info.provider || 'sql',
                'db.statement': this.mask(info.sql),
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
                span.setStatus({ code: 2, message: info.error.message });
            }
            else {
                span.setStatus({ code: 1 });
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