import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
/**
 * Property decorator that registers column metadata for the target entity property.
 *
 * If the `type` is not provided, it will be inferred from the TypeScript design type
 * via `reflect-metadata` and mapped to a reasonable SQL type.
 *
 * @param options Column configuration options.
 * @returns A property decorator that records column metadata.
 */
export function Column(options = {}) {
    return function ColumnDecorator(targetOrValue, propOrContext) {
        // Stage-3 (TS5) field decorator
        if (isStage3FieldContext(propOrContext)) {
            const ctx = propOrContext;
            const name = ctx.name.toString();
            ctx.addInitializer?.(function () {
                const ctor = this?.constructor;
                if (!ctor)
                    return;
                const designType = Reflect.getMetadata('design:type', ctor.prototype, name);
                const columnMetadata = {
                    propertyName: name,
                    columnName: options?.name || name,
                    type: options?.type || getTypeString(designType),
                    nullable: options?.nullable !== false,
                    defaultValue: options?.defaultValue,
                    length: options?.length,
                    precision: options?.precision,
                    scale: options?.scale,
                    isGenerated: options?.generated || false,
                    isVersion: options?.version || false
                };
                MetadataStorage.addColumn(ctor, columnMetadata);
                const existing = Reflect.getOwnMetadata('orm:columns', ctor) || [];
                existing.push(columnMetadata);
                Reflect.defineMetadata('orm:columns', existing, ctor);
            });
            return;
        }
        // Legacy decorator
        const target = targetOrValue;
        const propertyKey = propOrContext;
        const propertyName = propertyKey.toString();
        const designType = Reflect.getMetadata('design:type', target, propertyKey);
        const columnMetadata = {
            propertyName,
            columnName: options?.name || propertyName,
            type: options?.type || getTypeString(designType),
            nullable: options?.nullable !== false,
            defaultValue: options?.defaultValue,
            length: options?.length,
            precision: options?.precision,
            scale: options?.scale,
            isGenerated: options?.generated || false,
            isVersion: options?.version || false
        };
        MetadataStorage.addColumn(target.constructor, columnMetadata);
        const ctor = target.constructor;
        const existing = Reflect.getOwnMetadata('orm:columns', ctor) || [];
        existing.push(columnMetadata);
        Reflect.defineMetadata('orm:columns', existing, ctor);
    };
}
/**
 * Map a JavaScript/TypeScript runtime constructor to a default SQL type.
 *
 * @param type The runtime constructor captured by `reflect-metadata` (e.g., String, Number).
 * @returns A string representing the SQL type to use.
 */
function getTypeString(type) {
    if (!type || !type.name)
        return 'TEXT';
    switch (type.name) {
        case 'String':
            return 'TEXT';
        case 'Number':
            return 'INTEGER';
        case 'Boolean':
            return 'BOOLEAN';
        case 'Date':
            return 'DATETIME';
        case 'Array':
            return 'TEXT'; // Store as JSON
        case 'Object':
            return 'TEXT'; // Store as JSON
        default:
            return 'TEXT';
    }
}
//# sourceMappingURL=Column.js.map