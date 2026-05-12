"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryKey = PrimaryKey;
const MetadataStorage_1 = require("./MetadataStorage");
/**
 * Legacy property decorator that marks a property as the primary key.
 */
function PrimaryKey(options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        // Ensure entity metadata exists (property decorators run before class decorator)
        let meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
        if (!meta) {
            // Register entity with default table name, @Entity will override later
            MetadataStorage_1.MetadataStorage.addEntity(ctor, ctor.name);
            meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
        }
        const columnMeta = {
            propertyName: name,
            columnName: options?.name || name,
            type: options?.type || 'INTEGER',
            nullable: false,
            isGenerated: !!options?.autoIncrement,
            isVersion: !!options?.version
        };
        MetadataStorage_1.MetadataStorage.addColumn(ctor, columnMeta);
        MetadataStorage_1.MetadataStorage.addPrimaryKey(ctor, name);
        if (options.branded) {
            const col = meta?.columns.find((c) => c.propertyName === name);
            if (col) {
                col.isBranded = true;
                col.brand = ctor.name;
            }
        }
    };
}
//# sourceMappingURL=PrimaryKey.js.map