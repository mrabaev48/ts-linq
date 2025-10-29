import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
/**
 * Legacy decorator that marks a class as a database entity (table).
 * Uses reflect-metadata for metadata storage.
 */
export function Entity(options = {}) {
    return function (target) {
        const tableName = options?.name || target.name;
        // Register entity with MetadataStorage
        MetadataStorage.addEntity(target, tableName);
        return target;
    };
}
//# sourceMappingURL=Entity.js.map