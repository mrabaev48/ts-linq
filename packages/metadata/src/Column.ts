import type { ColumnMetadata, ColumnType } from '@ts-linq/types';

import { MetadataStorage } from './MetadataStorage';

/**
 * Options for configuring a column mapping on an entity property.
 */
export interface ColumnOptions {
  name?: string;
  type?: ColumnType;
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
 * Legacy property decorator that registers column metadata.
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor =
      typeof target === 'function' ? target : (target as { constructor: Function }).constructor;

    // Ensure entity metadata exists (property decorators run before class decorator)
    if (!MetadataStorage.getEntity(ctor)) {
      MetadataStorage.addEntity(ctor, ctor.name);
    }

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
  };
}
