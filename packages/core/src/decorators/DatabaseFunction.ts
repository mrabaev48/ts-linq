import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata } from '../types';

function isStage3FieldContext(x: unknown): x is { kind: 'field'; name: string | symbol; addInitializer?(fn: (this: unknown) => void): void } {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in (x as object);
}

export function DatabaseFunction(expression: string, nameOverride?: string) {
  return function DatabaseFunctionDecorator(_initialValue: unknown, context: ClassFieldDecoratorContext) {
    if (context.kind !== 'field') {
      throw new Error('@DatabaseFunction requires TS5 Stage-3 decorators');
    }
    const name = String(context.name);
    context.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;

      // Create or update column metadata with defaultExpression
      const columnMetadata: ColumnMetadata = {
        propertyName: name,
        columnName: nameOverride || name,
        type: 'TEXT',
        nullable: true,
        isGenerated: false,
        isVersion: false,
        defaultExpression: expression
      };
      MetadataStorage.addColumn(ctor, columnMetadata);

      // Maintain rehydration store for Entity decorator
      const existing: ColumnMetadata[] = Reflect.getOwnMetadata('orm:columns', ctor) || [];
      const existingColIndex = existing.findIndex(c => c.propertyName === name);
      if (existingColIndex > -1) {
        existing[existingColIndex] = { ...existing[existingColIndex], defaultExpression: expression };
      } else {
        existing.push(columnMetadata);
      }
      Reflect.defineMetadata('orm:columns', existing, ctor);
    });
  };
}


