import { MetadataStorage } from './MetadataStorage';
export function DatabaseFunction(expression, nameOverride) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        const expr = typeof expression === 'string' ? expression : (expression.default ?? '');
        const columnMetadata = {
            propertyName: name,
            columnName: nameOverride || name,
            type: 'TEXT',
            nullable: true,
            isGenerated: false,
            isVersion: false,
            defaultExpression: expr,
            defaultExpressionDialect: typeof expression === 'string'
                ? undefined
                : {
                    sqlite: expression.sqlite,
                    postgresql: expression.postgresql,
                    mysql: expression.mysql,
                    mssql: expression.mssql
                }
        };
        MetadataStorage.addColumn(ctor, columnMetadata);
    };
}
//# sourceMappingURL=DatabaseFunction.js.map