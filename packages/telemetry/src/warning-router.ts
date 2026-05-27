import type { WarningBehavior } from '@ts-linq/types';

/**
 * Thrown when a warning event is configured with .throw(eventId).
 * Mirrors EF Core's behaviour of converting a warning into an exception.
 */
export class EfWarningError extends Error {
  constructor(
    public readonly eventId: string,
    message: string
  ) {
    super(`[${eventId}] ${message}`);
    this.name = 'EfWarningError';
  }
}

/**
 * Fluent builder for the per-event warning route table.
 *
 * @example
 * configureWarnings(w => w
 *   .throw('relational.multiple-collection-include')
 *   .log('core.first-without-order-by-and-filter')
 *   .suppress('core.sensitive-data-logging-enabled'))
 */
export class WarningConfigurationBuilder {
  private readonly _routes = new Map<string, WarningBehavior>();

  /** Escalate this event to an EfWarningError exception. */
  throw(eventId: string): this {
    this._routes.set(eventId, 'throw');
    return this;
  }

  /** Force this event to be logged regardless of the configured log level. */
  log(eventId: string): this {
    this._routes.set(eventId, 'log');
    return this;
  }

  /** Silence this event entirely — no output, no exception. */
  suppress(eventId: string): this {
    this._routes.set(eventId, 'suppress');
    return this;
  }

  /** Return the immutable route table. */
  build(): ReadonlyMap<string, WarningBehavior> {
    return this._routes;
  }
}
