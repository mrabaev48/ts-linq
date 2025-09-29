import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
export function ComputedColumn(options) {
    return function ComputedColumnDecorator(_targetOrValue, propOrContext) {
        if (!isStage3FieldContext(propOrContext)) {
            throw new Error('@ComputedColumn requires TS5 Stage-3 decorators');
        }
        const ctx = propOrContext;
        const name = ctx.name.toString();
        ctx.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            const columnMetadata = {
                propertyName: name,
                columnName: options?.name || name,
                type: 'TEXT',
                nullable: true,
                isGenerated: false,
                isVersion: false,
                isComputed: true,
                computedExpression: options.expression
            };
            MetadataStorage.addColumn(ctor, columnMetadata);
            const existing = Reflect.getOwnMetadata('orm:columns', ctor) || [];
            const existingColIndex = existing.findIndex((c) => c.propertyName === name);
            if (existingColIndex > -1) {
                existing[existingColIndex] = columnMetadata;
            }
            else {
                existing.push(columnMetadata);
            }
            Reflect.defineMetadata('orm:columns', existing, ctor);
        });
    };
}
//# sourceMappingURL=ComputedColumn.js.map