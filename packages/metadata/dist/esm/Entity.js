import { MetadataStorage } from './MetadataStorage';
/**
 * Class decorator that registers a class as a database entity (table).
 * Uses legacy TypeScript decorators (experimentalDecorators: true).
 */
export function Entity(options = {}) {
    return function (target) {
        const tableName = options?.name || target.name;
        MetadataStorage.addEntity(target, tableName);
        return target;
    };
}
//# sourceMappingURL=Entity.js.map