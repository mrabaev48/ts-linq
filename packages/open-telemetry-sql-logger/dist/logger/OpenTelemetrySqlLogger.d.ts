import type { SqlLogger, SqlParameter } from '@ts-linq/core';
export interface OpenTelemetryLoggerOptions {
    maskSql?: boolean;
    maskPatterns?: ReadonlyArray<RegExp>;
}
export declare class OpenTelemetrySqlLogger implements SqlLogger {
    private tracer;
    private spanByTraceId;
    private maskSql;
    private maskPatterns;
    constructor(serviceName?: string, options?: OpenTelemetryLoggerOptions);
    private mask;
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
    analysis?(info: {
        sql: string;
        params: readonly SqlParameter[];
        durationMs: number;
        provider?: string;
        slow?: boolean;
        explainPlan?: unknown;
        recommendations?: ReadonlyArray<string>;
    }): void;
}
//# sourceMappingURL=OpenTelemetrySqlLogger.d.ts.map