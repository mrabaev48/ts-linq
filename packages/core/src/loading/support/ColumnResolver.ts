import type { EntityMetadata } from '@ts-linq/types';

/**
 * Resolve the database column name backing an entity's first primary key,
 * falling back to the property name and finally `'id'`. Mirrors the historical
 * `getPrimaryKeyColumnName` / `targetPkCol` resolution shared by the loaders.
 */
export function primaryKeyColumnName(meta: EntityMetadata): string {
  const pkProperty = meta.primaryKeys?.[0];
  if (!pkProperty) return 'id';
  return meta.columns.find((c) => c.propertyName === pkProperty)?.columnName ?? pkProperty;
}

/**
 * Resolve the database column name backing a given property on an entity,
 * falling back to the property name itself. Mirrors the historical
 * `getColumnNameForPk` helper.
 */
export function columnNameForProperty(
  meta: EntityMetadata | undefined,
  propertyName: string
): string {
  return (
    (meta?.columns ?? []).find((c) => c.propertyName === propertyName)?.columnName ?? propertyName
  );
}
