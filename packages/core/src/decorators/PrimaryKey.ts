import type { ColumnMetadata } from '@ts-linq/types';
import { PendingMetadataCollector } from '@ts-linq/metadata';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  addInitializer?: (fn: () => void) => void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

export interface PrimaryKeyOptions {
  name?: string;
  type?: string;
  autoIncrement?: boolean;
  version?: boolean;
  branded?: boolean;
}

/**
 * Stage-3 property decorator that marks a column as a primary key.
 * Metadata is collected in PendingMetadataCollector and finalized by @Entity.
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function PrimaryKeyDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor;
      if (!ctor) return;
      
      const columnMeta: ColumnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || 'INTEGER',
        nullable: false,
        isGenerated: !!options?.autoIncrement,
        isVersion: !!options?.version,
        isBranded: options?.branded,
        brand: options?.branded ? ctor.name : undefined
      };
      
      PendingMetadataCollector.addColumn(ctor, columnMeta);
      PendingMetadataCollector.addPrimaryKey(ctor, name);
    });
  };
}
