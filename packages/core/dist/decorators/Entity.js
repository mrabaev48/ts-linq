"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = Entity;
require("reflect-metadata");
const MetadataStorage_1 = require("../metadata/MetadataStorage");
/**
 * Class decorator that registers a class as a database entity (table).
 *
 * @param options Entity configuration options.
 * @returns A class decorator that records entity metadata.
 */
function Entity(options = {}) {
    return function (target) {
        const tableName = options?.name || target.name;
        // Persist table name on the constructor for optional external rehydration
        Reflect.defineMetadata('orm:tableName', tableName, target);
        // Register entity metadata immediately
        MetadataStorage_1.MetadataStorage.addEntity(target, tableName);
        // Return lightweight subclass that re-registers metadata if storage was cleared
        const ExtendedClass = class extends target {
            constructor(...args) {
                super(...args);
                if (!MetadataStorage_1.MetadataStorage.getEntity(target)) {
                    const tn = Reflect.getOwnMetadata('orm:tableName', target) || tableName;
                    MetadataStorage_1.MetadataStorage.addEntity(target, tn);
                    const columns = Reflect.getOwnMetadata('orm:columns', target) || [];
                    for (const col of columns) {
                        MetadataStorage_1.MetadataStorage.addColumn(target, col);
                    }
                    const primaryKeys = Reflect.getOwnMetadata('orm:primaryKeys', target) || [];
                    for (const pk of primaryKeys) {
                        MetadataStorage_1.MetadataStorage.addPrimaryKey(target, pk);
                    }
                    const relationships = Reflect.getOwnMetadata('orm:relationships', target) || [];
                    for (const rel of relationships) {
                        const te = rel.targetEntity;
                        const resolvedTarget = typeof te === 'function' && te.prototype
                            ? te
                            : te();
                        MetadataStorage_1.MetadataStorage.addRelationship(target, { ...rel, targetEntity: resolvedTarget });
                    }
                }
            }
        };
        // Let storage map back from Extended to original for getEntity lookups
        Reflect.defineMetadata('orm:original', target, ExtendedClass);
        return ExtendedClass;
    };
}
//# sourceMappingURL=Entity.js.map