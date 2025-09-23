import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata } from '../types';

function isStage3FieldContext(x: unknown): x is { kind: 'field'; name: string | symbol; addInitializer?(fn: (this: unknown) => void): void } {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in (x as object);
}

export interface ComputedColumnOptions {
  /** SQL expression for the computed column (provider-agnostic as possible). */
  expression: string;
  /** Optional column name override. */
  name?: string;
  /** Whether the computed value is persisted (if supported by provider). */
  persisted?: boolean;
}

export function ComputedColumn(options: ComputedColumnOptions): PropertyDecorator {
  return function ComputedColumnDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@ComputedColumn requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const columnMetadata: ColumnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: 'TEXT',
        nullable: true,
        isGenerated: false,
        isVersion: false,
        isComputed: true,
        computedExpression: options.expression,
      };
      MetadataStorage.addColumn(ctor, columnMetadata);
      const existing: ColumnMetadata[] = Reflect.getOwnMetadata('orm:columns', ctor) || [];
      const existingColIndex = existing.findIndex(c => c.propertyName === name);
      if (existingColIndex > -1) {
        existing[existingColIndex] = columnMetadata;
      } else {
        existing.push(columnMetadata);
      }
      Reflect.defineMetadata('orm:columns', existing, ctor);
    });
  };
}


