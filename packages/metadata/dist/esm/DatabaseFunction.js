import { MetadataStorage } from './MetadataStorage';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
export function DatabaseFunction(expression, nameOverride) {
    return function DatabaseFunctionDecorator(_initialValue, context) {
        if (context.kind !== 'field') {
            throw new Error('@DatabaseFunction requires TS5 Stage-3 decorators');
        }
        const name = String(context.name);
        context.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            // Create or update column metadata with defaultExpression
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
        });
    };
}
//# sourceMappingURL=DatabaseFunction.js.map