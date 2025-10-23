import type { ColumnMetadata, ColumnType } from '@ts-linq/types';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

/**
 * Options for configuring a column mapping on an entity property.
 */
export interface ColumnOptions {
  name?: string;
  type?: ColumnType | string;
  nullable?: boolean;
  defaultValue?: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  generated?: boolean;
  /** Marks this column as an optimistic concurrency token (version). */
  version?: boolean;
}

// WeakMap to track pending columns per constructor
function getPendingColumns(ctor: Function): ColumnMetadata[] {
  if (!(globalThis as any).__tsLinqPendingColumns) {
    (globalThis as any).__tsLinqPendingColumns = new WeakMap();
  }
  if (!(globalThis as any).__tsLinqPendingColumns.has(ctor)) {
    (globalThis as any).__tsLinqPendingColumns.set(ctor, []);
  }
  return (globalThis as any).__tsLinqPendingColumns.get(ctor);
}

/**
 * Stage-3 property decorator that registers column metadata.
 * Queues metadata for collection by @Entity decorator's addInitializer.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function ColumnDecorator(value: unknown, context: unknown) {
    if (!isStage3FieldContext(context)) {
      throw new Error('@Column requires TS5 Stage-3 decorators');
    }
    
    const ctx = context;
    const propertyName = ctx.name.toString();
    
    const columnMetadata: ColumnMetadata = {
      propertyName,
      columnName: options?.name || propertyName,
      type: options?.type || 'TEXT',
      nullable: options?.nullable !== false,
      defaultValue: options?.defaultValue,
      length: options?.length,
      precision: options?.precision,
      scale: options?.scale,
      isGenerated: options?.generated || false,
      isVersion: options?.version || false
    };
    
    // Return initializer that queues metadata for @Entity to collect
    return function(initialValue: unknown) {
      const ctor = (this as any)?.constructor;
      if (ctor) {
        const pending = getPendingColumns(ctor);
        if (!pending.some((c: ColumnMetadata) => c.propertyName === propertyName)) {
          pending.push(columnMetadata);
        }
      }
      return initialValue;
    };
  };
}
