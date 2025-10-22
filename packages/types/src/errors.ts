// Error classes - no external dependencies

export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
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
