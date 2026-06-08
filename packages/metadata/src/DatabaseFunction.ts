import type { ColumnMetadata, EntityCtor } from '@ts-linq/types';

import { MetadataStorage } from './MetadataStorage';

export function DatabaseFunction(
  expression: string | { postgresql?: string; mysql?: string; mssql?: string; default?: string },
  nameOverride?: string
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

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
              postgresql: expression.postgresql,
              mysql: expression.mysql,
              mssql: expression.mssql
            }
    };

    MetadataStorage.addColumn(ctor, columnMetadata);
  };
}
