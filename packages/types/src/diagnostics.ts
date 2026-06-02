// Diagnostic configuration and severity levels (P2-45)

/** Severity levels mirroring EF Core's LogLevel enum. */
export type LogLevel =
  | 'trace'
  | 'debug'
  | 'information'
  | 'warning'
  | 'error'
  | 'critical'
  | 'none';

/** Action to take when a diagnostic event matches a configured warning route. */
export type WarningBehavior = 'throw' | 'log' | 'suppress';

/**
 * Configuration produced by DbContextOptionsBuilder logging methods.
 * Consumed by DiagnosticEmitter in @ts-linq/telemetry.
 */
export interface DiagnosticConfig {
  /** User-supplied sink function; receives formatted diagnostic messages. */
  sink?: (message: string) => void;
  /** Minimum severity that will be forwarded to the sink. Defaults to 'information'. */
  level?: LogLevel;
  /** When true, raw SQL parameter values are included in messages. Defaults to false (masked). */
  sensitiveDataEnabled?: boolean;
  /** When true, full stack traces are appended to error messages. Defaults to false. */
  detailedErrors?: boolean;
  /** Per-event routing overrides: eventId → 'throw' | 'log' | 'suppress'. */
  warningRoutes?: ReadonlyMap<string, WarningBehavior>;
}
