/**
 * Logging port for the migration runner.
 *
 * Mirrors the CLI's `ports/Logger` so the CLI's console adapter can be injected directly. The
 * library itself must never call `console.*` — callers opt into output by passing a logger;
 * otherwise the {@link NO_OP_LOGGER} default keeps the runner silent.
 */
export interface MigrationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Default {@link MigrationLogger} that discards all messages (library stays quiet by default). */
export const NO_OP_LOGGER: MigrationLogger = {
  info(): void {},
  warn(): void {},
  error(): void {}
};
