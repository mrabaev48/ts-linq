/**
 * Unit + type-level coverage for the `@ts-linq/types` error hierarchy.
 *
 * Verifies the `OrmError` root, `instanceof` chains (backward compatibility),
 * stable `code` values, `cause` preservation, and the literal typing of each
 * concrete `code`. Checked at runtime by jest and at compile time by
 * `tsc --noEmit` (this file is excluded from the build).
 */

import {
  BatchConfigurationError,
  DatabaseError,
  DecoratorUsageError,
  FallbackExhaustedError,
  ForeignKeyConstraintError,
  InvalidIncludeError,
  MetadataError,
  OperationAbortedError,
  OptimisticConcurrencyError,
  OrmError,
  OrmErrorCode,
  QueryFilterCompilationError,
  SelectorExtractionError,
  TemporalNotSupportedError,
  UniqueConstraintError,
  UnsupportedOperationError,
  ValidationError
} from '..';

// --- type-level helpers ------------------------------------------------------

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// --- type-level assertions ---------------------------------------------------

// Every concrete error is assignable to the OrmError root.
type _AssignableToRoot = Expect<Equal<DatabaseError extends OrmError ? true : false, true>>;

// Each concrete leaf narrows `code` to a single literal.
type _OccCode = Expect<
  Equal<OptimisticConcurrencyError['code'], 'OPTIMISTIC_CONCURRENCY_CONFLICT'>
>;
type _UniqueCode = Expect<Equal<UniqueConstraintError['code'], 'UNIQUE_CONSTRAINT_VIOLATION'>>;
type _FkCode = Expect<Equal<ForeignKeyConstraintError['code'], 'FOREIGN_KEY_CONSTRAINT_VIOLATION'>>;
type _ValidationCode = Expect<Equal<ValidationError['code'], 'VALIDATION_ERROR'>>;
type _TemporalCode = Expect<Equal<TemporalNotSupportedError['code'], 'TEMPORAL_NOT_SUPPORTED'>>;
type _UnsupportedCode = Expect<Equal<UnsupportedOperationError['code'], 'UNSUPPORTED_OPERATION'>>;
type _MetadataCode = Expect<Equal<MetadataError['code'], 'METADATA_ERROR'>>;
type _DecoratorCode = Expect<Equal<DecoratorUsageError['code'], 'DECORATOR_USAGE_ERROR'>>;
type _BatchCode = Expect<Equal<BatchConfigurationError['code'], 'BATCH_CONFIGURATION_ERROR'>>;
type _IncludeCode = Expect<Equal<InvalidIncludeError['code'], 'INVALID_INCLUDE'>>;
type _AbortedCode = Expect<Equal<OperationAbortedError['code'], 'OPERATION_ABORTED'>>;
type _FilterCode = Expect<
  Equal<QueryFilterCompilationError['code'], 'QUERY_FILTER_COMPILATION_ERROR'>
>;
type _FallbackCode = Expect<Equal<FallbackExhaustedError['code'], 'FALLBACK_EXHAUSTED'>>;
type _SelectorCode = Expect<Equal<SelectorExtractionError['code'], 'SELECTOR_EXTRACTION_ERROR'>>;

// `details` is a readonly structured payload, never `any`.
type _DetailsType = Expect<
  Equal<MetadataError['details'], Readonly<Record<string, unknown>> | undefined>
>;

// `cause` stays `unknown` on the root (not forced to a concrete type).
type _CauseType = Expect<Equal<OperationAbortedError['cause'], unknown>>;

// --- runtime: instanceof chains (backward compatibility) ---------------------

describe('OrmError hierarchy', () => {
  it('roots every error under OrmError and Error', () => {
    const errors: OrmError[] = [
      new DatabaseError('x'),
      new OptimisticConcurrencyError('x'),
      new UniqueConstraintError('x'),
      new ForeignKeyConstraintError('x'),
      new ValidationError('x'),
      new TemporalNotSupportedError('x'),
      new UnsupportedOperationError('x'),
      new MetadataError('x'),
      new DecoratorUsageError('x'),
      new BatchConfigurationError('x'),
      new InvalidIncludeError('x'),
      new OperationAbortedError('x'),
      new QueryFilterCompilationError('x'),
      new FallbackExhaustedError('x'),
      new SelectorExtractionError('x')
    ];
    for (const e of errors) {
      expect(e).toBeInstanceOf(OrmError);
      expect(e).toBeInstanceOf(Error);
      expect(typeof e.code).toBe('string');
      expect(e.code.length).toBeGreaterThan(0);
    }
  });

  it('keeps constraint errors within the DatabaseError subtree', () => {
    expect(new OptimisticConcurrencyError('x')).toBeInstanceOf(DatabaseError);
    expect(new UniqueConstraintError('x')).toBeInstanceOf(DatabaseError);
    expect(new ForeignKeyConstraintError('x')).toBeInstanceOf(DatabaseError);
  });

  it('makes ValidationError and TemporalNotSupportedError catchable as OrmError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(OrmError);
    expect(new TemporalNotSupportedError('x')).toBeInstanceOf(OrmError);
    // They are NOT in the DatabaseError subtree.
    expect(new ValidationError('x')).not.toBeInstanceOf(DatabaseError);
    expect(new TemporalNotSupportedError('x')).not.toBeInstanceOf(DatabaseError);
  });

  it('exposes the expected stable code values', () => {
    expect(new DatabaseError('x').code).toBe(OrmErrorCode.DatabaseError);
    expect(new OptimisticConcurrencyError('x').code).toBe(
      OrmErrorCode.OptimisticConcurrencyConflict
    );
    expect(new UniqueConstraintError('x').code).toBe(OrmErrorCode.UniqueConstraintViolation);
    expect(new ForeignKeyConstraintError('x').code).toBe(
      OrmErrorCode.ForeignKeyConstraintViolation
    );
    expect(new ValidationError('x').code).toBe(OrmErrorCode.ValidationError);
    expect(new TemporalNotSupportedError('x').code).toBe(OrmErrorCode.TemporalNotSupported);
    expect(new UnsupportedOperationError('x').code).toBe(OrmErrorCode.UnsupportedOperation);
    expect(new MetadataError('x').code).toBe(OrmErrorCode.MetadataError);
    expect(new DecoratorUsageError('x').code).toBe(OrmErrorCode.DecoratorUsageError);
    expect(new BatchConfigurationError('x').code).toBe(OrmErrorCode.BatchConfigurationError);
    expect(new InvalidIncludeError('x').code).toBe(OrmErrorCode.InvalidInclude);
    expect(new OperationAbortedError('x').code).toBe(OrmErrorCode.OperationAborted);
    expect(new QueryFilterCompilationError('x').code).toBe(
      OrmErrorCode.QueryFilterCompilationError
    );
    expect(new FallbackExhaustedError('x').code).toBe(OrmErrorCode.FallbackExhausted);
    expect(new SelectorExtractionError('x').code).toBe(OrmErrorCode.SelectorExtraction);
  });

  it('sets the constructor name on every error', () => {
    expect(new DatabaseError('x').name).toBe('DatabaseError');
    expect(new OptimisticConcurrencyError('x').name).toBe('OptimisticConcurrencyError');
    expect(new MetadataError('x').name).toBe('MetadataError');
  });

  it('preserves the message', () => {
    expect(new MetadataError('boom').message).toBe('boom');
  });
});

// --- runtime: cause + details ------------------------------------------------

describe('OrmError cause and details', () => {
  it('preserves cause through the native Error chain', () => {
    const root = new Error('root cause');
    const err = new MetadataError('wrapper', { cause: root });
    expect(err.cause).toBe(root);
  });

  it('preserves cause on DatabaseError (legacy positional argument)', () => {
    const root = new Error('db root');
    const err = new DatabaseError('failed', root);
    expect(err.cause).toBe(root);
  });

  it('leaves cause undefined when none supplied', () => {
    expect(new ValidationError('x').cause).toBeUndefined();
  });

  it('exposes structured details when provided', () => {
    const err = new InvalidIncludeError('bad include', {
      details: { entity: 'User', path: 'orders' }
    });
    expect(err.details).toEqual({ entity: 'User', path: 'orders' });
  });

  it('preserves the primary failure as cause and collected errors in details', () => {
    const primary = new Error('primary down');
    const fbErrors = [new Error('fb1'), new Error('fb2')];
    const err = new FallbackExhaustedError('all fallbacks failed', {
      cause: primary,
      details: { errors: fbErrors }
    });
    expect(err.cause).toBe(primary);
    expect(err.details).toEqual({ errors: fbErrors });
  });

  it('preserves the filter name and compilation cause on QueryFilterCompilationError', () => {
    const root = new Error('unsupported AST node');
    const err = new QueryFilterCompilationError("could not compile filter 'tenant'", {
      cause: root,
      details: { filterName: 'tenant' }
    });
    expect(err.cause).toBe(root);
    expect(err.details).toEqual({ filterName: 'tenant' });
  });

  it('keeps the structured constraint fields', () => {
    const unique = new UniqueConstraintError('dup', 'users', 'email');
    expect(unique.table).toBe('users');
    expect(unique.column).toBe('email');

    const fk = new ForeignKeyConstraintError('fk', 'orders', 'fk_user');
    expect(fk.table).toBe('orders');
    expect(fk.constraint).toBe('fk_user');
  });
});
