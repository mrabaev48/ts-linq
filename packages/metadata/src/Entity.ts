import { MetadataStorage } from './MetadataStorage';

/**
 * Options for configuring an entity/table.
 *
 * - name: Explicit table name. Defaults to the class name if omitted.
 */
export interface EntityOptions {
  name?: string;
}

/**
 * Class decorator that registers a class as a database entity (table).
 * Uses legacy TypeScript decorators (experimentalDecorators: true).
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    const tableName = options?.name || target.name;
    MetadataStorage.addEntity(target, tableName);
    return target;
  };
}
