"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = Entity;
const metadata_1 = require("@ts-linq/metadata");
function isStage3ClassContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'class';
}
/**
 * Class decorator that registers a class as a database entity (table).
 * Requires TS5 Stage-3 decorators.
 */
function Entity(options = {}) {
    return function (target, context) {
        // TS5 Stage-3 path only
        if (isStage3ClassContext(context)) {
            // Compute tableName from options or class name
            const tableName = options?.name || target.name;
            // Register entity immediately
            metadata_1.MetadataStorage.addEntity(target, tableName);
            // Initializer to restore metadata after clear()
            context.addInitializer?.(function () {
                const ctor = target;
                // Recompute tableName to ensure correct value after clear
                const currentTableName = options?.name || ctor.name;
                const existing = metadata_1.MetadataStorage.getEntity(ctor);
                if (!existing) {
                    metadata_1.MetadataStorage.addEntity(ctor, currentTableName);
                }
            });
            return;
        }
        // If not Stage-3, fail fast per project policy
        throw new Error('@Entity requires TS5 Stage-3 decorators');
    };
}
//# sourceMappingURL=Entity.js.map