/**
 * Minimal internal error logger for swallowed catches.
 * Always logs to stderr. Keep side effects minimal to avoid masking original errors.
 */
export function logInternalError(context: string, error: unknown): void {
  try {
    const prefix = `[ts-linq internal] ${context}`;
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(prefix, error.stack || error.message);
    } else {
      // eslint-disable-next-line no-console
      console.error(prefix, String(error));
    }
  } catch {
    // last resort: never throw from logger
  }
}
