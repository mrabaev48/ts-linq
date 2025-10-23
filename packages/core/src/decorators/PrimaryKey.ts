import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata } from '@ts-linq/types';

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
  return function (target: Object, propertyKey: string | symbol): void {
    const ctor = target.constructor;
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
    MetadataStorage.addColumn(ctor as Function, columnMeta);
    
    // Mark as primary key
    MetadataStorage.addPrimaryKey(ctor as Function, propertyName);
  };
}
