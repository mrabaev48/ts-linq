import { MetadataStorage } from '../metadata/MetadataStorage';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
/**
 * Stage-3 property decorator that registers column metadata.
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
export function Column(options = {}) {
    return function ColumnDecorator(_targetOrValue, propOrContext) {
        if (!isStage3FieldContext(propOrContext)) {
            throw new Error('@Column requires TS5 Stage-3 decorators');
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
        });
    };
}
//# sourceMappingURL=Column.js.map