import type { ColumnMetadata, EntityMetadata } from '@ts-linq/types';

/**
 * Explicit, declared policy for {@link selectInsertableColumns}. Legitimate per-dialect differences
 * are expressed as configuration here rather than as accidental divergence between copy-pasted
 * predicates (Parameterize-from-above / Policy object).
 */
export interface InsertableColumnOptions {
  /**
   * Exclude columns flagged `isComputed`. A computed column is derived by the database and can never
   * be written, so this is `true` for every current dialect.
   */
  readonly excludeComputed: boolean;
  /**
   * Exclude a primary-key column that carries no supplied value, even when it is not flagged
   * `isGenerated`. Matches common SERIAL/IDENTITY usage where the database assigns the key.
   */
  readonly excludeGeneratedPk: boolean;
}

function hasValue(entity: Record<string, unknown>, propertyName: string): boolean {
  const v = entity[propertyName];
  return v !== null && v !== undefined;
}

/**
 * Select the columns to include in an INSERT column list for a single entity, under an explicit
 * {@link InsertableColumnOptions} policy.
 *
 * Always excludes a generated column that has no supplied value (so the database assigns it). The
 * computed-column and primary-key heuristics are opt-in via the policy. Single source of truth for
 * insertable-column selection across dialects and their `batch-syntax` builders.
 */
export function selectInsertableColumns(
  metadata: EntityMetadata,
  entity: Record<string, unknown>,
  options: InsertableColumnOptions
): ColumnMetadata[] {
  const primaryKeys = new Set<string>(metadata.primaryKeys ?? []);
  return metadata.columns.filter((c) => {
    if (options.excludeComputed && c.isComputed) return false;
    if (c.isGenerated && !hasValue(entity, c.propertyName)) return false;
    if (
      options.excludeGeneratedPk &&
      primaryKeys.has(c.propertyName) &&
      !hasValue(entity, c.propertyName)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Select the columns to include in an UPDATE SET list: everything except primary keys, generated
 * columns and computed columns. Single source of truth for updatable-column selection across
 * dialects and their `batch-syntax` builders.
 */
export function selectUpdatableColumns(metadata: EntityMetadata): ColumnMetadata[] {
  const primaryKeys = metadata.primaryKeys ?? [];
  return metadata.columns.filter(
    (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
  );
}
