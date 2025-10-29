import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
/**
 * Legacy property decorator that marks a column as a primary key.
 * Uses reflect-metadata for metadata storage.
 */
export function PrimaryKey(options = {}) {
    return function (target, propertyKey) {
        // For legacy decorators, target is the prototype, target.constructor is the class
        const ctor = (target?.constructor || target);
        const propertyName = String(propertyKey);
        const columnMeta = {
            propertyName,
            columnName: options?.name || propertyName,
            type: options?.type || 'INTEGER',
            nullable: false,
            isGenerated: !!options?.autoIncrement,
            isVersion: !!options?.version
        };
        // Add column metadata
        MetadataStorage.addColumn(ctor, columnMeta);
        // Mark as primary key
        MetadataStorage.addPrimaryKey(ctor, propertyName);
    };
}
//# sourceMappingURL=PrimaryKey.js.map