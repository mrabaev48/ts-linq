import type { ColumnMetadata, IndexMetadata } from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

/**
 * Single-source validation for a newly added index.
 *
 * Previously this logic was copied across the finalized and builder branches of
 * `addIndexMetadata`, where the two copies had already drifted. Both paths now
 * call this function so the rules — and their error messages — stay identical.
 *
 * @throws ValidationError when `index.name` collides with an existing index, or
 *   when `index.columns` reference column or property names not present on the
 *   entity. The error wording is preserved verbatim for behavioural parity.
 */
export function validateIndex(
  index: IndexMetadata,
  existingIndexes: readonly IndexMetadata[],
  existingColumns: readonly ColumnMetadata[],
  tableName: string
): void {
  if (existingIndexes.some((i) => i.name === index.name)) {
    throw new ValidationError(`Duplicate index name '${index.name}' on entity '${tableName}'`);
  }
  const existingCols = new Set(existingColumns.map((c) => [c.columnName, c.propertyName]).flat());
  const missing = index.columns.filter((c) => !existingCols.has(c));
  if (missing.length > 0) {
    throw new ValidationError(
      `Index '${index.name}' on entity '${tableName}' references unknown columns: ${missing.join(', ')}`
    );
  }
}
