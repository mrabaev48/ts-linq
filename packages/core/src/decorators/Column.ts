import type { ColumnMetadata, ColumnType } from '@ts-linq/types';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  access: { get?: () => any; set?: (value: any) => void };
  addInitializer?: (fn: () => void) => void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field';
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

// Global registry for pending metadata
if (!(globalThis as any).__tsLinqPendingMetadata) {
  (globalThis as any).__tsLinqPendingMetadata = {
    columns: new WeakMap<Function, ColumnMetadata[]>(),
    primaryKeys: new WeakMap<Function, string[]>(),
    relationships: new WeakMap<Function, any[]>(),
    indexes: new WeakMap<Function, any[]>()
  };
}

/**
 * Stage-3 property decorator that registers column metadata.
 * Uses addInitializer if available, otherwise registers immediately.
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
    
    // Try to use addInitializer if available (may not work in SWC 2022-03 for field decorators)
    if (ctx.addInitializer) {
      // This won't work in SWC 2022-03, but we try anyway
      ctx.addInitializer(function(this: any) {
        const ctor = this.constructor || this;
        const registry = (globalThis as any).__tsLinqPendingMetadata.columns;
        if (!registry.has(ctor)) {
          registry.set(ctor, []);
        }
        const cols = registry.get(ctor);
        if (!cols.some((c: ColumnMetadata) => c.propertyName === propertyName)) {
          cols.push(columnMetadata);
        }
      });
    } else {
      // Fallback: store with a marker that @Entity will pick up
      if (!(globalThis as any).__tsLinqOrphanedColumns) {
        (globalThis as any).__tsLinqOrphanedColumns = [];
      }
      (globalThis as any).__tsLinqOrphanedColumns.push(columnMetadata);
    }
  };
}
