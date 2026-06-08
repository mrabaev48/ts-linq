import type { ColumnMetadata, EntityCtor } from '@ts-linq/types';

import { MetadataStorage } from './MetadataStorage';

export interface ComputedColumnOptions {
  /** SQL expression for the computed column (provider-agnostic as possible). */
  expression: string;
  /** Optional column name override. */
  name?: string;
  /** Whether the computed value is persisted (if supported by provider). */
  persisted?: boolean;
}

export function ComputedColumn(options: ComputedColumnOptions): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor: EntityCtor =
      typeof target === 'function'
        ? (target as EntityCtor)
        : (target as { constructor: EntityCtor }).constructor;

    const columnMetadata: ColumnMetadata = {
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
