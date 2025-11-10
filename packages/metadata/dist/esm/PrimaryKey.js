import { MetadataStorage } from './MetadataStorage';
/**
 * Legacy property decorator that marks a property as the primary key.
 */
export function PrimaryKey(options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        // Ensure entity metadata exists (property decorators run before class decorator)
        let meta = MetadataStorage.getEntity(ctor);
        if (!meta) {
            // Register entity with default table name, @Entity will override later
            MetadataStorage.addEntity(ctor, ctor.name);
            meta = MetadataStorage.getEntity(ctor);
        }
        const columnMeta = {
            propertyName: name,
            columnName: options?.name || name,
            type: options?.type || 'INTEGER',
            nullable: false,
            isGenerated: !!options?.autoIncrement,
            isVersion: !!options?.version
        };
        MetadataStorage.addColumn(ctor, columnMeta);
        MetadataStorage.addPrimaryKey(ctor, name);
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