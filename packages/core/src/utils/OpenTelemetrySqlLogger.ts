import type { SqlLogger, SqlParameter } from '../types';

/** Minimal subset of OpenTelemetry API we use dynamically. */
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

/**
 * OpenTelemetry-based SqlLogger implementation.
 * Uses dynamic require to avoid hard dependency on @opentelemetry/api.
 */
// Moved to package 'open-telemetry-sql-logger'
