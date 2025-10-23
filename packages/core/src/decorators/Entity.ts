import { MetadataStorage } from '@ts-linq/metadata';
import { PENDING_COLUMNS, PENDING_PRIMARY_KEYS, PENDING_INDEXES, PENDING_RELATIONSHIPS } from './Column';
import type { ColumnMetadata, IndexMetadata, RelationshipMetadata } from '@ts-linq/types';

/**
 * Options for configuring an entity/table.
 *
 * - name: Explicit table name. Defaults to the class name if omitted.
 */
export interface EntityOptions {
  name?: string;
}

function isStage3ClassContext(
  x: unknown
): x is { 
  kind: 'class'; 
  name?: string; 
  metadata?: Record<symbol, unknown>;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'class';
}

/**
 * Class decorator that registers a class as a database entity (table).
 * Collects all field metadata from @Column, @PrimaryKey, etc. and registers with MetadataStorage.
 * Requires TS5 Stage-3 decorators.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(
    target: TFunction,
    context?: unknown
  ): TFunction | void {
    // TS5 Stage-3 path only
    if (isStage3ClassContext(context)) {
      // Compute tableName from options or class name
      const tableName = options?.name || target.name;
      
      // Register entity in MetadataStorage
      MetadataStorage.addEntity(target, tableName);
      
      // Collect all pending metadata from field decorators via context.metadata
      if (context.metadata) {
        // Process columns
        const pendingColumns = context.metadata[PENDING_COLUMNS] as Map<string, ColumnMetadata> | undefined;
        if (pendingColumns) {
          for (const [_propertyName, columnMeta] of pendingColumns.entries()) {
            // Set brand name for branded columns
            if (columnMeta.isBranded) {
              columnMeta.brand = target.name;
            }
            MetadataStorage.addColumn(target, columnMeta);
          }
        }
        
        // Process primary keys
        const pendingPrimaryKeys = context.metadata[PENDING_PRIMARY_KEYS] as Set<string> | undefined;
        if (pendingPrimaryKeys) {
          for (const propertyName of pendingPrimaryKeys) {
            MetadataStorage.addPrimaryKey(target, propertyName);
          }
        }
        
        // Process indexes
        const pendingIndexes = context.metadata[PENDING_INDEXES] as IndexMetadata[] | undefined;
        if (pendingIndexes) {
          for (const indexMeta of pendingIndexes) {
            MetadataStorage.addIndex(target, indexMeta);
          }
        }
        
        // Process relationships
        const pendingRelationships = context.metadata[PENDING_RELATIONSHIPS] as Map<string, RelationshipMetadata> | undefined;
        if (pendingRelationships) {
          for (const [_propertyName, relationMeta] of pendingRelationships.entries()) {
            MetadataStorage.addRelationship(target, relationMeta);
          }
        }
      }
      
      return;
    }

    // If not Stage-3, fail fast per project policy
    throw new Error('@Entity requires TS5 Stage-3 decorators');
  };
}
