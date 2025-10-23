import type { ColumnMetadata } from '@ts-linq/types';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
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

// Helper functions for pending metadata
function getPendingColumns(ctor: Function): ColumnMetadata[] {
  if (!(globalThis as any).__tsLinqPendingColumns) {
    (globalThis as any).__tsLinqPendingColumns = new WeakMap();
  }
  if (!(globalThis as any).__tsLinqPendingColumns.has(ctor)) {
    (globalThis as any).__tsLinqPendingColumns.set(ctor, []);
  }
  return (globalThis as any).__tsLinqPendingColumns.get(ctor);
}

function getPendingPrimaryKeys(ctor: Function): string[] {
  if (!(globalThis as any).__tsLinqPendingPrimaryKeys) {
    (globalThis as any).__tsLinqPendingPrimaryKeys = new WeakMap();
  }
  if (!(globalThis as any).__tsLinqPendingPrimaryKeys.has(ctor)) {
    (globalThis as any).__tsLinqPendingPrimaryKeys.set(ctor, []);
  }
  return (globalThis as any).__tsLinqPendingPrimaryKeys.get(ctor);
}

/**
 * Stage-3 property decorator that marks a column as a primary key.
 * Queues metadata for collection by @Entity decorator's addInitializer.
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
      isVersion: !!options?.version,
      isBranded: options?.branded,
      brand: undefined // Will be set to ctor.name by @Entity
    };
    
    // Return initializer that queues metadata for @Entity to collect
    return function(this: unknown, initialValue: unknown) {
      const ctor = (this as any)?.constructor;
      if (ctor) {
        // Queue column metadata
        const pendingCols = getPendingColumns(ctor);
        if (!pendingCols.some(c => c.propertyName === propertyName)) {
          // Set brand name if branded
          if (columnMeta.isBranded) {
            columnMeta.brand = ctor.name;
          }
          pendingCols.push(columnMeta);
        }
        
        // Queue primary key
        const pendingPKs = getPendingPrimaryKeys(ctor);
        if (!pendingPKs.includes(propertyName)) {
          pendingPKs.push(propertyName);
        }
      }
      return initialValue;
    };
  };
}
