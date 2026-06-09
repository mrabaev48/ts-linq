// Base error hierarchy - no external dependencies.
//
// Every ORM failure is an `OrmError`: an abstract root carrying a stable
// machine-readable `code`, an optional structured `details` payload, and a
// preserved `cause` chain (native ES2022 `Error` cause). Downstream code can
// discriminate failures with `if (e instanceof OrmError) { … e.code … }`
// without string-matching messages.

/**
 * Construction options shared by every {@link OrmError}.
 *
 * - `cause` is intentionally `unknown`: the original failure may be anything a
 *   caller decides to chain, and we never widen it into the public type.
 * - `details` is a structured context payload for logging/observability. Field
 *   names are safe to log; values are supplied by the caller, who is
 *   responsible for not leaking sensitive data.
 */
export interface OrmErrorOptions {
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;
}

/**
 * Stable error codes for the shared `@ts-linq/types` error hierarchy.
 *
 * Exposed as an `as const` object plus a derived union type (rather than a
 * `const enum`) so the values survive `isolatedModules` and cross-package
 * bundling without inlining hazards.
 */
export const OrmErrorCode = {
  DatabaseError: 'DATABASE_ERROR',
  OptimisticConcurrencyConflict: 'OPTIMISTIC_CONCURRENCY_CONFLICT',
  UniqueConstraintViolation: 'UNIQUE_CONSTRAINT_VIOLATION',
  ForeignKeyConstraintViolation: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
  ValidationError: 'VALIDATION_ERROR',
  TemporalNotSupported: 'TEMPORAL_NOT_SUPPORTED',
  UnsupportedOperation: 'UNSUPPORTED_OPERATION',
  MetadataError: 'METADATA_ERROR',
  DecoratorUsageError: 'DECORATOR_USAGE_ERROR',
  BatchConfigurationError: 'BATCH_CONFIGURATION_ERROR',
  InvalidInclude: 'INVALID_INCLUDE',
  OperationAborted: 'OPERATION_ABORTED',
  InvalidIdentifier: 'INVALID_IDENTIFIER',
  EntityNotFound: 'ENTITY_NOT_FOUND',
  OwnedEntityHydrationError: 'OWNED_ENTITY_HYDRATION_ERROR',
  RelationshipLoadError: 'RELATIONSHIP_LOAD_ERROR'
} as const;

/** Union of every stable code declared in {@link OrmErrorCode}. */
export type OrmErrorCode = (typeof OrmErrorCode)[keyof typeof OrmErrorCode];

/**
 * Abstract root of the ORM error hierarchy.
 *
 * Cannot be instantiated directly; every concrete failure category extends it
 * and provides its own literal `code`. The `name` is derived from the concrete
 * constructor so subclasses do not have to repeat it.
 */
export abstract class OrmError extends Error {
  /** Stable, machine-readable failure code. Subclasses narrow this to a literal. */
  public abstract readonly code: string;

  /**
   * The underlying cause, preserved via the native ES2022 `Error` cause chain.
   * Declared here (not emitted) so the property is visible to consumers
   * regardless of whether their own `lib` includes `ES2022.Error`.
   */
  declare readonly cause?: unknown;

  /** Optional structured context payload for logging/observability. */
  public readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.details = opts?.details;
  }
}

/** A generic database-layer failure. */
export class DatabaseError extends OrmError {
  public readonly code: string = OrmErrorCode.DatabaseError;

  // Preserve the historical `cause?: Error` readable surface for this subtree.
  declare readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message, { cause });
  }
}

/** Thrown when an optimistic concurrency version check fails. */
export class OptimisticConcurrencyError extends DatabaseError {
  public override readonly code = OrmErrorCode.OptimisticConcurrencyConflict;

  constructor(message: string) {
    super(message);
  }
}

/** Thrown when a UNIQUE constraint is violated. */
export class UniqueConstraintError extends DatabaseError {
  public override readonly code = OrmErrorCode.UniqueConstraintViolation;

  constructor(
    message: string,
    public readonly table?: string,
    public readonly column?: string
  ) {
    super(message);
  }
}

/** Thrown when a FOREIGN KEY constraint is violated. */
export class ForeignKeyConstraintError extends DatabaseError {
  public override readonly code = OrmErrorCode.ForeignKeyConstraintViolation;

  constructor(
    message: string,
    public readonly table?: string,
    public readonly constraint?: string
  ) {
    super(message);
  }
}

/** Thrown when model/entity validation fails. */
export class ValidationError extends OrmError {
  public readonly code = OrmErrorCode.ValidationError;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a temporal query operator is used with a dialect that does not
 * support SQL Server `FOR SYSTEM_TIME` syntax (e.g. PostgreSQL, MySQL).
 *
 * Mirrors EF Core's restriction of temporal queries to SQL Server only.
 */
export class TemporalNotSupportedError extends OrmError {
  public readonly code = OrmErrorCode.TemporalNotSupported;

  constructor(message: string) {
    super(message);
  }
}

/** Thrown when an operation is not supported by the current provider/dialect. */
export class UnsupportedOperationError extends OrmError {
  public readonly code = OrmErrorCode.UnsupportedOperation;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/** Thrown when entity/model metadata is missing or inconsistent. */
export class MetadataError extends OrmError {
  public readonly code = OrmErrorCode.MetadataError;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/** Thrown when a decorator is applied incorrectly or in an unsupported environment. */
export class DecoratorUsageError extends OrmError {
  public readonly code = OrmErrorCode.DecoratorUsageError;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/** Thrown when batch operation configuration is invalid. */
export class BatchConfigurationError extends OrmError {
  public readonly code = OrmErrorCode.BatchConfigurationError;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/** Thrown when an `include`/`thenInclude` path cannot be resolved. */
export class InvalidIncludeError extends OrmError {
  public readonly code = OrmErrorCode.InvalidInclude;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/** Thrown when an operation is aborted via an `AbortSignal`. */
export class OperationAbortedError extends OrmError {
  public readonly code = OrmErrorCode.OperationAborted;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/**
 * Thrown when a SQL identifier (table/column name) fails validation before
 * being quoted into a query. Acts as a defense-in-depth guard against SQL
 * injection through the identifier position: an invalid identifier fails
 * closed (throws) rather than being interpolated into SQL text.
 */
export class InvalidIdentifierError extends OrmError {
  public readonly code = OrmErrorCode.InvalidIdentifier;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/**
 * Thrown when an operation targeted a row by key that does not exist — e.g. an
 * UPDATE that affected zero rows with no concurrency token. Acts as the typed
 * "row absent" signal that the default `upsert` discriminates on to fall back
 * to INSERT, instead of treating arbitrary errors as a missing row.
 */
export class EntityNotFoundError extends DatabaseError {
  public override readonly code = OrmErrorCode.EntityNotFound;

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Thrown when an owned entity cannot be hydrated from its persisted form — e.g.
 * a corrupt JSON column that fails `JSON.parse`. Surfaces the failure instead
 * of silently dropping the owned entity. `details` carries safe-to-log context
 * (column / owned type) and `cause` preserves the original parse error.
 */
export class OwnedEntityHydrationError extends OrmError {
  public readonly code = OrmErrorCode.OwnedEntityHydrationError;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}

/**
 * Thrown when loading a relationship for an entity fails. Makes a partial load
 * observable to the caller rather than returning a silently half-populated
 * entity. `details` carries the relationship/entity names and `cause` preserves
 * the underlying load failure.
 */
export class RelationshipLoadError extends OrmError {
  public readonly code = OrmErrorCode.RelationshipLoadError;

  constructor(message: string, opts?: OrmErrorOptions) {
    super(message, opts);
  }
}
