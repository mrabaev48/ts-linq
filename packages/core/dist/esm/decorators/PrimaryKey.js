import { MetadataStorage } from '../metadata/MetadataStorage';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
export function PrimaryKey(options = {}) {
    return function PrimaryKeyDecorator(_targetOrValue, propOrContext) {
        if (!isStage3FieldContext(propOrContext)) {
            throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
        }
        const ctx = propOrContext;
        const name = ctx.name.toString();
        ctx.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            const columnMeta = {
                propertyName: name,
                columnName: options?.name || name,
                type: options?.type || 'INTEGER',
                nullable: false,
                isGenerated: !!options?.autoIncrement,
                isVersion: !!options?.version
            };
            MetadataStorage.addColumn(ctor, columnMeta);
            const existingCols = Reflect.getOwnMetadata('orm:columns', ctor) || [];
            existingCols.push(columnMeta);
            Reflect.defineMetadata('orm:columns', existingCols, ctor);
            MetadataStorage.addPrimaryKey(ctor, name);
            if (options.branded) {
                const meta = MetadataStorage.getEntity(ctor);
                const col = meta?.columns.find((c) => c.propertyName === name);
                if (col) {
                    col.isBranded = true;
                    col.brand = ctor.name;
                }
            }
            const existingPks = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
            if (!existingPks.includes(name))
                existingPks.push(name);
            Reflect.defineMetadata('orm:primaryKeys', existingPks, ctor);
        });
    };
}
//# sourceMappingURL=PrimaryKey.js.map