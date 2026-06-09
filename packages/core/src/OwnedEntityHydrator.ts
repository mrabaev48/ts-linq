import type { JsonShape, JsonShapeNode, OwnedEntityMetadata } from '@ts-linq/types';
import { OwnedEntityHydrationError, StorageStrategy } from '@ts-linq/types';

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
 * When a JsonShape is provided, nested aggregates are recursively hydrated.
 */
export function hydrateJson<TOwned>(
  row: Record<string, unknown>,
  ownedCtor: new () => TOwned,
  columnName: string,
  shape?: JsonShape
): TOwned | undefined {
  const raw = row[columnName];
  if (raw === null || raw === undefined) return undefined;

  let data: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      // A corrupt JSON column must not silently drop the owned entity: surface
      // a typed error with safe context so the data-loss is observable.
      throw new OwnedEntityHydrationError(
        `Failed to parse JSON for owned entity column '${columnName}'`,
        { cause: e, details: { column: columnName, ownedType: ownedCtor.name } }
      );
    }
  } else if (typeof raw === 'object') {
    data = raw as Record<string, unknown>;
  } else {
    return undefined;
  }

  return hydrateJsonObject(data, ownedCtor, shape);
}

/**
 * Recursively hydrate a plain JSON object into an owned entity instance.
 * Uses the JsonShape descriptor for nested aggregates.
 */
function hydrateJsonObject<TOwned>(
  data: Record<string, unknown>,
  ownedCtor: new () => TOwned,
  shape?: JsonShape
): TOwned {
  const instance = new ownedCtor();
  for (const [key, value] of Object.entries(data)) {
    const shapeNode = shape?.properties.get(key);
    if (shapeNode && shapeNode.children && value !== null && value !== undefined) {
      (instance as Record<string, unknown>)[key] = hydrateJsonNode(value, shapeNode);
    } else if (shapeNode?.converter && value !== null && value !== undefined) {
      (instance as Record<string, unknown>)[key] = shapeNode.converter.fromProvider(value);
    } else {
      (instance as Record<string, unknown>)[key] = value;
    }
  }
  return instance;
}

function hydrateJsonNode(value: unknown, node: JsonShapeNode): unknown {
  if (node.isArray) {
    if (!Array.isArray(value)) return value;
    return value.map((item) =>
      typeof item === 'object' && item !== null
        ? hydrateJsonObjectPlain(item as Record<string, unknown>, node.children)
        : item
    );
  }
  if (typeof value === 'object' && value !== null) {
    return hydrateJsonObjectPlain(value as Record<string, unknown>, node.children);
  }
  return value;
}

function hydrateJsonObjectPlain(
  data: Record<string, unknown>,
  children?: Map<string, JsonShapeNode>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const childNode = children?.get(key);
    if (childNode?.children && value !== null && value !== undefined) {
      result[key] = hydrateJsonNode(value, childNode);
    } else if (childNode?.converter && value !== null && value !== undefined) {
      result[key] = childNode.converter.fromProvider(value);
    } else {
      result[key] = value;
    }
  }
  return result;
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
      const hydrated = hydrateJson(row, ctor, colName, owned.jsonShape);
      if (hydrated !== undefined) {
        ownerInstance[owned.ownerPropertyName] = hydrated;
      }
    }
  }
}
