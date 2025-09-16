import type { SqlLogger, SqlParameter } from '../types';
/**
 * OpenTelemetry-based SqlLogger implementation.
 * Uses dynamic require to avoid hard dependency on @opentelemetry/api.
 */
export declare class OpenTelemetrySqlLogger implements SqlLogger {
    private tracer;
    private spanByTraceId;
    constructor(serviceName?: string);
    queryStart(info: {
        sql: string;
        params: readonly SqlParameter[];
        traceId?: string;
        provider?: string;
    }): void;
    queryEnd(info: {
        sql: string;
        params: readonly SqlParameter[];
        durationMs: number;
        traceId?: string;
        rows?: number;
        error?: Error;
        provider?: string;
    }): void;
}
//# sourceMappingURL=OpenTelemetrySqlLogger.d.ts.map