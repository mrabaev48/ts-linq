import type {
  ConnectionHealthCheckOptions,
  ConnectionPoolOptions,
  OrmMiddleware,
  RetryPolicy,
  SoftDeleteOptions,
  SqlLogger
} from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

import type { SavepointStrategy } from './strategies/SavepointStrategy';
import type { SequenceStrategy } from './strategies/SequenceStrategy';
import type { CircuitBreakerOptions, QueryPerformanceAnalysisOptions } from './types';

/**
 * Options bag accepted by {@link ProviderConfig}.
 *
 * `providerName` and `connectionString` are required; everything else is an
 * optional cross-cutting concern.
 */
export interface ProviderConfigOptions {
  /**
   * Logical provider name used for logging/metrics labels
   * (e.g. `postgresql` | `mysql` | `mssql`). Required up front so resilience and
   * health telemetry are labelled correctly from construction.
   */
  readonly providerName: string;
  /** Provider-specific connection string. */
  readonly connectionString: string;
  /** Optional SQL logger receiving query/transaction/circuit events. */
  readonly logger?: SqlLogger;
  /** Optional middleware chain. */
  readonly middlewares?: OrmMiddleware[];
  /** Optional soft-delete configuration. */
  readonly softDelete?: SoftDeleteOptions;
  /** Optional retry policy driving the resilience manager. */
  readonly retryPolicy?: RetryPolicy;
  /** Optional generic pool options forwarded to the underlying driver. */
  readonly poolOptions?: ConnectionPoolOptions;
  /** Optional connection health-check scheduler options. */
  readonly healthCheck?: ConnectionHealthCheckOptions;
  /** Optional circuit breaker options. */
  readonly circuitOptions?: CircuitBreakerOptions;
  /** Optional query performance analysis configuration. */
  readonly analysis?: QueryPerformanceAnalysisOptions;
  /** Optional dialect savepoint strategy (defaults to ANSI savepoint SQL). */
  readonly savepointStrategy?: SavepointStrategy;
  /** Optional dialect sequence strategy (defaults to "unsupported"). */
  readonly sequenceStrategy?: SequenceStrategy;
}

/**
 * Parameter Object for {@link DatabaseProvider}'s constructor.
 *
 * Collapses the legacy 8-positional-argument constructor into a single,
 * self-documenting value object. Crucially it makes `providerName` a required,
 * up-front value: the previous positional constructor built the
 * `ResilienceManager`/`HealthMonitor` with `providerName === 'unknown'` because
 * subclasses only assigned the real name *after* `super()` returned. Passing a
 * `ProviderConfig` lets the base assign `providerName` before those
 * collaborators are constructed, so their telemetry is labelled correctly.
 */
export class ProviderConfig {
  public readonly providerName: string;
  public readonly connectionString: string;
  public readonly logger?: SqlLogger;
  public readonly middlewares?: OrmMiddleware[];
  public readonly softDelete?: SoftDeleteOptions;
  public readonly retryPolicy?: RetryPolicy;
  public readonly poolOptions?: ConnectionPoolOptions;
  public readonly healthCheck?: ConnectionHealthCheckOptions;
  public readonly circuitOptions?: CircuitBreakerOptions;
  public readonly analysis?: QueryPerformanceAnalysisOptions;
  public readonly savepointStrategy?: SavepointStrategy;
  public readonly sequenceStrategy?: SequenceStrategy;

  constructor(options: ProviderConfigOptions) {
    if (typeof options.providerName !== 'string' || options.providerName.trim().length === 0) {
      throw new ValidationError('ProviderConfig requires a non-empty providerName.');
    }
    this.providerName = options.providerName;
    this.connectionString = options.connectionString;
    this.logger = options.logger;
    this.middlewares = options.middlewares;
    this.softDelete = options.softDelete;
    this.retryPolicy = options.retryPolicy;
    this.poolOptions = options.poolOptions;
    this.healthCheck = options.healthCheck;
    this.circuitOptions = options.circuitOptions;
    this.analysis = options.analysis;
    this.savepointStrategy = options.savepointStrategy;
    this.sequenceStrategy = options.sequenceStrategy;
  }
}
