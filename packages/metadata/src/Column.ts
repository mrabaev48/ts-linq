import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata, ColumnType } from '../types';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  addInitializer?: (fn: (this: unknown) => void) => void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
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
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function ColumnDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@Column requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor;
      if (!ctor) return;
      const columnMetadata: ColumnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || 'TEXT',
        nullable: options?.nullable !== false,
        defaultValue: options?.defaultValue,
        length: options?.length,
        precision: options?.precision,
        scale: options?.scale,
        isGenerated: options?.generated || false,
        isVersion: options?.version || false
      };
      MetadataStorage.addColumn(ctor, columnMetadata);
    });
  };
}
