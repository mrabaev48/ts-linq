import type { ColumnMetadata, ComplexTypePropertyMetadata } from '@ts-linq/types';

/**
 * Recursively flattens a ComplexTypePropertyMetadata tree into a list of ColumnMetadata
 * whose columnName/propertyName are prefixed with the accumulated owner prefix.
 *
 * Example: shippingAddress { street, city } with default prefix "shippingAddress_"
 * → [{ propertyName: "shippingAddress_street", columnName: "shippingAddress_street" }, ...]
 *
 * For nested complex types the prefix accumulates:
 * address { coords { lat } } → "address_coords_lat"
 */
export function flattenComplexType(
  meta: ComplexTypePropertyMetadata,
  inheritedPrefix: string = meta.columnPrefix
): ColumnMetadata[] {
  const result: ColumnMetadata[] = [];

  for (const col of meta.properties) {
    result.push({
      ...col,
      propertyName: `${inheritedPrefix}${col.propertyName}`,
      columnName: `${inheritedPrefix}${col.columnName}`
    });
  }

  for (const nested of meta.nested) {
    const nestedPrefix = `${inheritedPrefix}${nested.columnPrefix}`;
    result.push(...flattenComplexType(nested, nestedPrefix));
  }

  return result;
}

/**
 * Returns the set of top-level complex property names for a given entity,
 * used by ChangeTracker and the SQL visitor to identify nested access paths.
 */
export function getComplexPropertyNames(
  complexProperties: ComplexTypePropertyMetadata[] | undefined
): Set<string> {
  if (!complexProperties?.length) return new Set();
  return new Set(complexProperties.map((cp) => cp.propertyName));
}
