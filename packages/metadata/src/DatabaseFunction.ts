import { MetadataStorage } from './MetadataStorage';
import type { ColumnMetadata } from '@ts-linq/types';

export function DatabaseFunction(
  expression:
    | string
    | { sqlite?: string; postgresql?: string; mysql?: string; mssql?: string; default?: string },
  nameOverride?: string
): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor = target.constructor;
    
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
  };
}
