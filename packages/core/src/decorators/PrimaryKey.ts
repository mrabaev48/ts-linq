import type { ColumnMetadata } from '@ts-linq/types';
import { PENDING_COLUMNS, PENDING_PRIMARY_KEYS } from './Column';

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  metadata?: Record<symbol, unknown>;
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
 * Uses context.metadata to share data with @Entity decorator.
 */
export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
  return function PrimaryKeyDecorator(_targetOrValue: unknown, propOrContext: unknown) {
    if (!isStage3FieldContext(propOrContext)) {
      throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
    }
    const ctx = propOrContext;
    const name = ctx.name.toString();
    
    // Store in shared context.metadata
    if (ctx.metadata) {
      // Add column metadata
      if (!ctx.metadata[PENDING_COLUMNS]) {
        ctx.metadata[PENDING_COLUMNS] = new Map<string, ColumnMetadata>();
      }
      
      const columns = ctx.metadata[PENDING_COLUMNS] as Map<string, ColumnMetadata>();
      const columnMeta: ColumnMetadata = {
        propertyName: name,
        columnName: options?.name || name,
        type: options?.type || 'INTEGER',
        nullable: false,
        isGenerated: !!options?.autoIncrement,
        isVersion: !!options?.version,
        isBranded: options?.branded,
        brand: options?.branded ? '' : undefined // Will be set by @Entity with class name
      };
      
      columns.set(name, columnMeta);
      
      // Mark as primary key
      if (!ctx.metadata[PENDING_PRIMARY_KEYS]) {
        ctx.metadata[PENDING_PRIMARY_KEYS] = new Set<string>();
      }
      
      const primaryKeys = ctx.metadata[PENDING_PRIMARY_KEYS] as Set<string>;
      primaryKeys.add(name);
    }
  };
}
