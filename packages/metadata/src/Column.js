"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Column = Column;
const MetadataStorage_1 = require("./MetadataStorage");
/**
 * Legacy property decorator that registers column metadata.
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
function Column(options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        // Ensure entity metadata exists (property decorators run before class decorator)
        if (!MetadataStorage_1.MetadataStorage.getEntity(ctor)) {
            MetadataStorage_1.MetadataStorage.addEntity(ctor, ctor.name);
        }
        const columnMetadata = {
            propertyName: name,
            columnName: options?.name || name,
            type: options?.type || 'TEXT',
            nullable: options?.nullable !== false,
            defaultValue: options?.defaultValue,
            length: options?.length,
            precision: options?.precision,
            scale: options?.scale,
            isGenerated: options?.generated || false,
            isVersion: options?.version || false
        };
        MetadataStorage_1.MetadataStorage.addColumn(ctor, columnMetadata);
    };
}
//# sourceMappingURL=Column.js.map