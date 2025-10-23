import type { ColumnMetadata, ColumnType } from '@ts-linq/types';

// Symbols for storing pending metadata in decorator context
const PENDING_COLUMNS = Symbol('pendingColumns');
const PENDING_PRIMARY_KEYS = Symbol('pendingPrimaryKeys');
const PENDING_INDEXES = Symbol('pendingIndexes');
const PENDING_RELATIONSHIPS = Symbol('pendingRelationships');

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  metadata?: Record<symbol, unknown>;
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

/**
 * Stage-3 property decorator that registers column metadata.
 * Uses context.metadata to share data with @Entity decorator.
 * 
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
export function Column(options: ColumnOptions = {}): PropertyDecorator {
  return function ColumnDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@Column requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    
    // Store column metadata in shared context.metadata object
    // This is accessible to @Entity class decorator
    if (ctx.metadata) {
      if (!ctx.metadata[PENDING_COLUMNS]) {
        ctx.metadata[PENDING_COLUMNS] = new Map<string, ColumnMetadata>();
      }
      
      const columns = ctx.metadata[PENDING_COLUMNS] as Map<string, ColumnMetadata>;
      const columnMetadata: ColumnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || 'TEXT',
        nullable: options?.nullable !== false,
        defaultValue: options?.defaultValue,
        length: options?.length,
        precision: options?.precision,
        scale: options?.scale,
        isGenerated: options?.generated || false,
        isVersion: options?.version || false
      };
      
      columns.set(name, columnMetadata);
    }
  };
}

// Export symbols so other decorators can use them
export { PENDING_COLUMNS, PENDING_PRIMARY_KEYS, PENDING_INDEXES, PENDING_RELATIONSHIPS };
