import { MetadataStorage } from '@ts-linq/metadata';
function isStage3ClassContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'class';
}
/**
 * Class decorator that registers a class as a database entity (table).
 * Requires TS5 Stage-3 decorators.
 */
export function Entity(options = {}) {
    return function (target, context) {
        // TS5 Stage-3 path only
        if (isStage3ClassContext(context)) {
            // Compute tableName from options or class name
            const tableName = options?.name || target.name;
            // Register entity immediately
            MetadataStorage.addEntity(target, tableName);
            // Initializer to restore metadata after clear()
            context.addInitializer?.(function () {
                const ctor = target;
                // Recompute tableName to ensure correct value after clear
                const currentTableName = options?.name || ctor.name;
                const existing = MetadataStorage.getEntity(ctor);
                if (!existing) {
                    MetadataStorage.addEntity(ctor, currentTableName);
                }
            });
            return;
        }
        // If not Stage-3, fail fast per project policy
        throw new Error('@Entity requires TS5 Stage-3 decorators');
    };
}
//# sourceMappingURL=Entity.js.map