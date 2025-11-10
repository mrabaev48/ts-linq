import { MetadataStorage } from './MetadataStorage';
import type { ColumnMetadata } from '@ts-linq/types';

export interface ComputedColumnOptions {
  /** SQL expression for the computed column (provider-agnostic as possible). */
  expression: string;
  /** Optional column name override. */
  name?: string;
  /** Whether the computed value is persisted (if supported by provider). */
  persisted?: boolean;
}

export function ComputedColumn(options: ComputedColumnOptions): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor = target.constructor;
    
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
