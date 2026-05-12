import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';

/**
 * Options for configuring an entity/table.
 */
export interface EntityOptions {
  /** Custom table name; defaults to the class name if not provided. */
  name?: string;
  /** Database schema name (for providers that support schemas). */
  schema?: string;
}

/**
 * Legacy decorator that marks a class as a database entity (table).
 * Uses reflect-metadata for metadata storage.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    const tableName = options?.name || target.name;
    
    // Register entity with MetadataStorage
    MetadataStorage.addEntity(target as Function, tableName);
    
    return target;
  };
}
