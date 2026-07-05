import type { ColumnMetadata, SqlParameter } from '@ts-linq/types';

/**
 * Apply a column's value converter (if any) on the way to the database.
 *
 * Pure, dialect-agnostic: a converter is a per-column policy declared in metadata, not a dialect
 * concern, so all dialects share this single implementation.
 */
export function applyConverter(value: unknown, col: ColumnMetadata): unknown {
  return col.converter ? col.converter.toProvider(value) : value;
}

/**
 * Coerce an arbitrary JS value into a driver-safe {@link SqlParameter}.
 *
 * Primitives, `Date` and `Uint8Array` pass through unchanged; everything else is JSON-serialized so
 * it can be bound as a text parameter. A non-serializable value (e.g. a circular reference) falls
 * back to `String(value)` rather than throwing. This is the single source of truth for parameter
 * coercion across every dialect and its `batch-syntax` module.
 */
export function coerceSqlParameter(value: unknown): SqlParameter {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}
