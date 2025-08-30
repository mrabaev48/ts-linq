import { MetadataStorage } from '../metadata/MetadataStorage';

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
 *
 * @param options Entity configuration options.
 * @returns A class decorator that records entity metadata.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
    return function (target: Function) {
        const tableName = options?.name || target.name;
        MetadataStorage.addEntity(target, tableName);
    };
}
