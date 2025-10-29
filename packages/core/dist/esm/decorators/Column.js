import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
/**
 * Legacy property decorator that registers column metadata.
 * Uses reflect-metadata for metadata storage.
 */
export function Column(options = {}) {
    return function (target, propertyKey) {
        // For legacy decorators, target is the prototype, target.constructor is the class
        const ctor = (target?.constructor || target);
        const propertyName = String(propertyKey);
        const columnMetadata = {
            propertyName,
            columnName: options?.name || propertyName,
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