import { MetadataStorage } from '../metadata/MetadataStorage';
import { Column } from './Column';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
/**
 * Property decorator that marks a property as the primary key.
 *
 * Supports both legacy (experimentalDecorators) and TS5 Stage-3 field decorators.
 */
export function PrimaryKey(options = {}) {
    return function PrimaryKeyDecorator(targetOrValue, propOrContext) {
        // Stage-3 field decorator
        if (isStage3FieldContext(propOrContext)) {
            const ctx = propOrContext;
            const name = ctx.name.toString();
            ctx.addInitializer?.(function () {
                const ctor = this?.constructor;
                if (!ctor)
                    return;
                const columnOptions = {
                    ...options,
                    nullable: false,
                    generated: options?.autoIncrement
                };
                // Register column metadata first
                const designType = Reflect.getMetadata('design:type', ctor.prototype, name);
                const columnMeta = {
                    propertyName: name,
                    columnName: columnOptions.name || name,
                    type: columnOptions.type ||
                        (designType?.name === 'Number' ? 'INTEGER' : designType?.name === 'String' ? 'TEXT' : 'TEXT'),
                    nullable: false,
                    isGenerated: !!columnOptions.generated,
                    isVersion: !!columnOptions.version
                };
                MetadataStorage.addColumn(ctor, columnMeta);
                // Reflect persist (for rehydration paths)
                const existingCols = Reflect.getOwnMetadata('orm:columns', ctor) || [];
                existingCols.push(columnMeta);
                Reflect.defineMetadata('orm:columns', existingCols, ctor);
                // Register PK
                MetadataStorage.addPrimaryKey(ctor, name);
                // Branded annotation (optional)
                if (options.branded) {
                    const meta = MetadataStorage.getEntity(ctor);
                    const col = meta?.columns.find((c) => c.propertyName === name);
                    if (col) {
                        col.isBranded = true;
                        col.brand = ctor.name;
                    }
                }
                // Persist PK for rehydration
                const existing = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
                if (!existing.includes(name))
                    existing.push(name);
                Reflect.defineMetadata('orm:primaryKeys', existing, ctor);
            });
            return;
        }
        // Legacy decorator
        const target = targetOrValue;
        const propertyKey = propOrContext;
        const propertyName = propertyKey.toString();
        // Add as column first
        const columnOptions = {
            ...options,
            nullable: false,
            generated: options?.autoIncrement
        };
        Column({ ...columnOptions })(target, propertyKey);
        // Then add as primary key
        const ctor = target.constructor;
        MetadataStorage.addPrimaryKey(ctor, propertyName);
        // Optional brand markers
        try {
            if (options.branded) {
                const meta = MetadataStorage.getEntity(ctor);
                const col = meta?.columns.find((c) => c.propertyName === propertyName);
                if (col) {
                    col.isBranded = true;
                    col.brand = ctor.name;
                }
            }
        }
        catch { }
        // Persist for rehydration
        const existing = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
        if (!existing.includes(propertyName))
            existing.push(propertyName);
        Reflect.defineMetadata('orm:primaryKeys', existing, ctor);
    };
}
//# sourceMappingURL=PrimaryKey.js.map