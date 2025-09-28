import type { SqlLogger, SqlParameter } from '@ts-linq/core';
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
