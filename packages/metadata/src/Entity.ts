import type { EntityCtor } from '@ts-linq/types';

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
 *
 * The target is constrained to {@link EntityCtor}, so decorating a non-class
 * (or a class with a required-argument constructor) is a compile-time error.
 */
export function Entity(options: EntityOptions = {}) {
  return function <T extends EntityCtor>(target: T): T | void {
    const tableName = options?.name || target.name;
    MetadataStorage.addEntity(target, tableName);
    return target;
  };
}
