import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata, ColumnType } from '../types';

function isStage3FieldContext(
  x: unknown
): x is { kind: 'field'; name: string | symbol; addInitializer?: (fn: (this: unknown) => void) => void } {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in (x as object);
}

/**
 * Options for configuring a column mapping on an entity property.
 */
export interface ColumnOptions {
  name?: string;
  type?: ColumnType | string;
  nullable?: boolean;
  defaultValue?: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  generated?: boolean;
  /** Marks this column as an optimistic concurrency token (version). */
  version?: boolean;
}

/**
 * Stage-3 property decorator that registers column metadata.
 * If type is omitted and design:type is unavailable, defaults to TEXT.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function ColumnDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@Column requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const designType = Reflect.getMetadata('design:type', (ctor as any).prototype, name) as
        | { name?: string }
        | undefined;
      const columnMetadata: ColumnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || getTypeString(designType),
        nullable: options?.nullable !== false,
        defaultValue: options?.defaultValue,
        length: options?.length,
        precision: options?.precision,
        scale: options?.scale,
        isGenerated: options?.generated || false,
        isVersion: options?.version || false
      };
      MetadataStorage.addColumn(ctor, columnMetadata);
      const existing: ColumnMetadata[] = Reflect.getOwnMetadata('orm:columns', ctor) || [];
      existing.push(columnMetadata);
      Reflect.defineMetadata('orm:columns', existing, ctor);
    });
  };
}

function getTypeString(type: { name?: string } | undefined): ColumnType {
  if (!type || !type.name) return 'TEXT';
  switch (type.name) {
    case 'String':
      return 'TEXT';
    case 'Number':
      return 'INTEGER';
    case 'Boolean':
      return 'BOOLEAN';
    case 'Date':
      return 'DATETIME';
    case 'Array':
      return 'TEXT';
    case 'Object':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}
