/**
 * Internal error telemetry channel for swallowed catches.
 *
 * As a library, core stays silent by default and never writes to the console:
 * the output is routed through a single configurable Null Object handler (no-op
 * until one is installed). The host owns any console dependency and installs its
 * own handler from the composition root to redirect or surface diagnostics.
 *
 * The `logInternalError(context, error)` signature is the unified telemetry
 * channel used across core (interceptors, middleware, query analysis, loading,
 * caches). Keep it stable — extend the routing, do not fork the signature.
 */

/** Handler invoked for each internal error event. Safe-to-log args only. */
export type InternalErrorHandler = (context: string, error: unknown) => void;

/** Null Object default: undefined means silent (no-op). */
let handler: InternalErrorHandler | undefined;

/**
 * Install (or clear) the global internal-error handler. The library core is
 * silent by default; the host opts into output by installing a handler here
 * from its composition root (e.g. one that writes to the console or a
 * structured logger). Pass `undefined` to restore the silent Null Object
 * behaviour.
 */
export function setInternalErrorHandler(next?: InternalErrorHandler): void {
  handler = next;
}

/**
 * Route an internal error through the configured handler. Silent by default
 * (Null Object). Never throws — a misbehaving handler must not mask the
 * original error on a swallow path.
 */
export function logInternalError(context: string, error: unknown): void {
  if (!handler) return;
  try {
    handler(context, error);
  } catch {
    // last resort: never throw from logger
  }
}
