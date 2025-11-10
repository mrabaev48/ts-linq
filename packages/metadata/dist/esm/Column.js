import { MetadataStorage } from './MetadataStorage';
/**
 * Legacy property decorator that registers column metadata.
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
export function Column(options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        // Ensure entity metadata exists (property decorators run before class decorator)
        if (!MetadataStorage.getEntity(ctor)) {
            MetadataStorage.addEntity(ctor, ctor.name);
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
        MetadataStorage.addColumn(ctor, columnMetadata);
    };
}
//# sourceMappingURL=Column.js.map