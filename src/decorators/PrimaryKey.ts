import { MetadataStorage } from '../metadata/MetadataStorage';
import { Column, ColumnOptions } from './Column';

/**
 * Options for configuring a primary key property.
 * Extends `ColumnOptions` with `autoIncrement` to mark identity columns.
 */
export interface PrimaryKeyOptions extends ColumnOptions {
  autoIncrement?: boolean;
}

/**
 * Property decorator that marks a property as the primary key.
 *
 * This decorator first registers the property as a non-nullable column and optionally
 * marks it as generated (auto-increment), then records the primary key metadata.
 *
 * @param options Primary key configuration options.
 * @returns A property decorator.
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString();

    // Add as column first
    const columnOptions: ColumnOptions = {
      ...options,
      nullable: false,
      generated: options?.autoIncrement
    };

    Column(columnOptions)(target, propertyKey);

    // Then add as primary key
    MetadataStorage.addPrimaryKey(target.constructor, propertyName);

    // Persist PK for rehydration
    const ctor = target.constructor;
    const existing: string[] = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
    if (!existing.includes(propertyName)) {
      existing.push(propertyName);
    }
    Reflect.defineMetadata('orm:primaryKeys', existing, ctor);
  };
}
