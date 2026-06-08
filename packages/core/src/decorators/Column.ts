import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata, ColumnType, EntityCtor } from '@ts-linq/types';

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
 * Uses reflect-metadata for metadata storage.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    // For legacy decorators, target is the prototype, target.constructor is the class
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;
    const propertyName = String(propertyKey);

    const columnMetadata: ColumnMetadata = {
      propertyName,
      columnName: options?.name || propertyName,
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
