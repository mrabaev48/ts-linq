// Error classes - no external dependencies

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class OptimisticConcurrencyError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticConcurrencyError';
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(
    message: string,
    public readonly table?: string,
    public readonly column?: string
  ) {
    super(message);
    this.name = 'UniqueConstraintError';
  }
}

export class ForeignKeyConstraintError extends DatabaseError {
  constructor(
    message: string,
    public readonly table?: string,
    public readonly constraint?: string
  ) {
    super(message);
    this.name = 'ForeignKeyConstraintError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a temporal query operator is used with a dialect that does not
 * support SQL Server `FOR SYSTEM_TIME` syntax (e.g. PostgreSQL, MySQL).
 *
 * Mirrors EF Core's restriction of temporal queries to SQL Server only.
 */
export class TemporalNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalNotSupportedError';
  }
}
