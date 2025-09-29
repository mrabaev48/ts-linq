'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
function safeRequireOtel() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const otel = require('@opentelemetry/api');
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
//# sourceMappingURL=OpenTelemetrySqlLogger.js.map
