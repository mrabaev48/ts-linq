"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = Entity;
require("reflect-metadata");
const MetadataStorage_1 = require("../metadata/MetadataStorage");
function isStage3ClassContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'class';
}
/**
 * Class decorator that registers a class as a database entity (table).
 * Supports TS5 Stage-3 decorators and legacy decorators.
 */
function Entity(options = {}) {
    return function (target, context) {
        const tableName = options?.name || target.name;
        // TS5 Stage-3 path
        if (isStage3ClassContext(context)) {
            // Register entity immediately
            MetadataStorage_1.MetadataStorage.addEntity(target, tableName);
            context.addInitializer?.(function () {
                const ctor = target;
                // Sync any reflect-stored columns/primaryKeys/relationships into MetadataStorage
                try {
                    const cols = Reflect.getOwnMetadata('orm:columns', ctor) || [];
                    for (const col of cols) {
                        MetadataStorage_1.MetadataStorage.addColumn(ctor, col);
                    }
                    const pks = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
                    for (const pk of pks) {
                        MetadataStorage_1.MetadataStorage.addPrimaryKey(ctor, pk);
                    }
                    const rels = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
                    for (const rel of rels) {
                        const te = rel.targetEntity;
                        const resolvedTarget = typeof te === 'function' && te.prototype
                            ? te
                            : te();
                        MetadataStorage_1.MetadataStorage.addRelationship(ctor, { ...rel, targetEntity: resolvedTarget });
                    }
                    const idxs = Reflect.getOwnMetadata('orm:indexes', ctor) || [];
                    for (const idx of idxs) {
                        MetadataStorage_1.MetadataStorage.addIndex(ctor, idx);
                    }
                }
                catch {
                    /* ignore */
                }
            });
            return;
        }
        // Legacy decorators path: preserve previous behavior
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