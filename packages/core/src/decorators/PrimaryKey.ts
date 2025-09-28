import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnOptions } from './Column';

function isStage3FieldContext(
  x: unknown
): x is {
  kind: 'field';
  name: string | symbol;
  addInitializer?: (fn: (this: unknown) => void) => void;
} {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as { kind?: unknown }).kind === 'field' &&
    'name' in (x as object)
  );
}

export interface PrimaryKeyOptions extends ColumnOptions {
  autoIncrement?: boolean;
  branded?: boolean;
}

export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function PrimaryKeyDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor as Function | undefined;
      if (!ctor) return;
      const columnMeta = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || 'INTEGER',
        nullable: false,
        isGenerated: !!options?.autoIncrement,
        isVersion: !!options?.version
      } as const;
      MetadataStorage.addColumn(ctor, columnMeta as any);
      const existingCols: any[] = Reflect.getOwnMetadata('orm:columns', ctor) || [];
      existingCols.push(columnMeta);
      Reflect.defineMetadata('orm:columns', existingCols, ctor);

      MetadataStorage.addPrimaryKey(ctor, name);
      if (options.branded) {
        const meta = MetadataStorage.getEntity(ctor);
        const col = meta?.columns.find((c) => c.propertyName === name);
        if (col) {
          (col as any).isBranded = true;
          (col as any).brand = ctor.name;
        }
      }
      const existingPks: string[] = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
      if (!existingPks.includes(name)) existingPks.push(name);
      Reflect.defineMetadata('orm:primaryKeys', existingPks, ctor);
    });
  };
}
