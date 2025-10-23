import type { ColumnMetadata } from '@ts-linq/types';

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
 * Registers metadata using orphaned pattern for SWC compatibility.
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function PrimaryKeyDecorator(value: unknown, context: unknown) {
    if (!isStage3FieldContext(context)) {
      throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
    }
    
    const ctx = context;
    const propertyName = ctx.name.toString();
    
    const columnMeta: ColumnMetadata = {
      propertyName,
      columnName: options?.name || propertyName,
      type: options?.type || 'INTEGER',
      nullable: false,
      isGenerated: !!options?.autoIncrement,
      isVersion: !!options?.version
    };
    
    // Store as orphaned metadata for @Entity to collect
    if (!(globalThis as any).__tsLinqOrphanedColumns) {
      (globalThis as any).__tsLinqOrphanedColumns = [];
    }
    if (!(globalThis as any).__tsLinqOrphanedPrimaryKeys) {
      (globalThis as any).__tsLinqOrphanedPrimaryKeys = [];
    }
    
    (globalThis as any).__tsLinqOrphanedColumns.push(columnMeta);
    (globalThis as any).__tsLinqOrphanedPrimaryKeys.push(propertyName);
  };
}
