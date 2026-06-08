import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata, EntityCtor } from '@ts-linq/types';

export interface PrimaryKeyOptions {
  name?: string;
  type?: string;
  autoIncrement?: boolean;
  version?: boolean;
  branded?: boolean;
}

/**
 * Legacy property decorator that marks a column as a primary key.
 * Uses reflect-metadata for metadata storage.
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    // For legacy decorators, target is the prototype, target.constructor is the class
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;
    const propertyName = String(propertyKey);

    const columnMeta: ColumnMetadata = {
      propertyName,
      columnName: options?.name || propertyName,
      type: options?.type || 'INTEGER',
      nullable: false,
      isGenerated: !!options?.autoIncrement,
      isVersion: !!options?.version
    };

    // Add column metadata
    MetadataStorage.addColumn(ctor, columnMeta);

    // Mark as primary key
    MetadataStorage.addPrimaryKey(ctor, propertyName);
  };
}
