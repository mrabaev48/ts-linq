import type { OwnedEntityMetadata } from '@ts-linq/types';
import { StorageStrategy } from '@ts-linq/types';

/**
 * Reconstructs owned entity instances from a flat database row.
 * Used during materialization when owned entities use TableSplit or Json storage strategies.
 */

/**
 * Hydrate an owned entity instance from a flat row using TableSplit strategy.
 * Reads columns with the given prefix and maps them back to property names.
 */
export function hydrateTableSplit<TOwned>(
  row: Record<string, unknown>,
  ownedCtor: new () => TOwned,
  prefix: string,
  propertyToColumnMap?: Map<string, string>
): TOwned | undefined {
  const keys = Object.keys(row).filter((k) => k.startsWith(prefix));
  if (keys.length === 0) return undefined;

  const allNull = keys.every((k) => row[k] === null || row[k] === undefined);
  if (allNull) return undefined;

  const instance = new ownedCtor();
  for (const colKey of keys) {
    const propName = propertyToColumnMap
      ? [...propertyToColumnMap.entries()].find(([, col]) => `${prefix}${col}` === colKey)?.[0]
      : colKey.slice(prefix.length);
    if (propName) {
      (instance as Record<string, unknown>)[propName] = row[colKey];
    }
  }
  return instance;
}

/**
 * Hydrate an owned entity instance from a JSON column.
 * Parses the JSON string and assigns all properties to a new instance.
 */
export function hydrateJson<TOwned>(
  row: Record<string, unknown>,
  ownedCtor: new () => TOwned,
  columnName: string
): TOwned | undefined {
  const raw = row[columnName];
  if (raw === null || raw === undefined) return undefined;

  let data: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  } else if (typeof raw === 'object') {
    data = raw as Record<string, unknown>;
  } else {
    return undefined;
  }

  const instance = new ownedCtor();
  for (const [key, value] of Object.entries(data)) {
    (instance as Record<string, unknown>)[key] = value;
  }
  return instance;
}

/**
 * Hydrate all owned entities for a given owner instance from a flat row.
 * Applies the appropriate strategy for each owned navigation.
 */
export function hydrateOwnedEntities(
  row: Record<string, unknown>,
  ownerInstance: Record<string, unknown>,
  ownedMetas: OwnedEntityMetadata[]
): void {
  for (const owned of ownedMetas) {
    if (owned.isCollection) continue; // SeparateTable collections require separate queries

    if (owned.strategy === StorageStrategy.TableSplit) {
      const prefix = owned.columnPrefix ?? `${owned.ownerPropertyName}_`;
      const ctor = owned.ownedType as new () => unknown;
      const hydrated = hydrateTableSplit(row, ctor, prefix);
      if (hydrated !== undefined) {
        ownerInstance[owned.ownerPropertyName] = hydrated;
      }
    } else if (owned.strategy === StorageStrategy.Json) {
      const colName = owned.jsonColumnName ?? owned.ownerPropertyName;
      const ctor = owned.ownedType as new () => unknown;
      const hydrated = hydrateJson(row, ctor, colName);
      if (hydrated !== undefined) {
        ownerInstance[owned.ownerPropertyName] = hydrated;
      }
    }
  }
}
