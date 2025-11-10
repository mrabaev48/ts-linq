import { MetadataStorage } from './MetadataStorage';
export function ComputedColumn(options) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
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
    };
}
//# sourceMappingURL=ComputedColumn.js.map