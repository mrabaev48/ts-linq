// Value converters, comparers, generators and sequence metadata

// Metadata types for decorators
export type ColumnType =
  | 'INTEGER'
  | 'TEXT'
  | 'REAL'
  | 'BLOB'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIMESTAMP'
  | string;

export interface ValueConverterLike<TModel = unknown, TProvider = unknown> {
  toProvider(v: TModel): TProvider;
  fromProvider(v: TProvider): TModel;
}

export interface ValueComparerLike<T = unknown> {
  equals(a: T, b: T): boolean;
  hash(v: T): number;
  snapshot(v: T): T;
}

// ---------------------------------------------------------------------------
// Sequences (P1-21)
// ---------------------------------------------------------------------------

/** Model-level database sequence metadata. */
export interface SequenceMetadata {
  /** Sequence name as it will appear in the database. */
  name: string;
  /** Optional database schema (e.g. "shared"). */
  schema?: string;
  /** Numeric type of the sequence. Defaults to 'int'. */
  type?: 'int' | 'bigint';
  /** First value produced by the sequence. */
  startsAt?: number;
  /** Step between consecutive values. */
  incrementsBy?: number;
  /** Minimum value the sequence can produce. */
  minValue?: number;
  /** Maximum value the sequence can produce before cycling or throwing. */
  maxValue?: number;
  /** Whether the sequence wraps around when it reaches the boundary. */
  cyclesOn?: boolean;
}

// ---------------------------------------------------------------------------
// Value generators (P1-30)
// ---------------------------------------------------------------------------

export interface ValueGeneratorContext {
  entityClass: Function;
  propertyName: string;
}

export interface ValueGenerator<T = unknown> {
  next(context: ValueGeneratorContext): T;
}

export type ValueGeneratorClass<T = unknown> = new () => ValueGenerator<T>;
