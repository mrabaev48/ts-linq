import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata } from '../types';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  addInitializer?(fn: (this: unknown) => void): void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

export function DatabaseFunction(
  expression:
    | string
    | { sqlite?: string; postgresql?: string; mysql?: string; mssql?: string; default?: string },
  nameOverride?: string
) {
  return function DatabaseFunctionDecorator(
    _initialValue: unknown,
    context: ClassFieldDecoratorContext
  ) {
    if (context.kind !== 'field') {
      throw new Error('@DatabaseFunction requires TS5 Stage-3 decorators');
    }
    const name = String(context.name);
    context.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor;
      if (!ctor) return;

      // Create or update column metadata with defaultExpression
      const expr = typeof expression === 'string' ? expression : (expression.default ?? '');
      const columnMetadata: ColumnMetadata = {
        propertyName: name,
        columnName: nameOverride || name,
        type: 'TEXT',
        nullable: true,
        isGenerated: false,
        isVersion: false,
        defaultExpression: expr,
        defaultExpressionDialect:
          typeof expression === 'string'
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
