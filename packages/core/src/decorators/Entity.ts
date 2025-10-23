import { MetadataStorage } from '@ts-linq/metadata';

/**
 * Options for configuring an entity/table.
 */
export interface EntityOptions {
  /** Custom table name; defaults to the class name if not provided. */
  name?: string;
  /** Database schema name (for providers that support schemas). */
  schema?: string;
}

function isStage3ClassContext(x: unknown): x is {
  kind: 'class';
  name?: string;
  addInitializer?: (fn: () => void) => void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'class';
}

/**
 * Stage-3 class decorator that marks a class as a database entity (table).
 * Collects all pending field metadata and registers everything with MetadataStorage.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(
    target: TFunction,
    context?: unknown
  ): TFunction | void {
    if (!isStage3ClassContext(context)) {
      throw new Error('@Entity requires TS5 Stage-3 decorators');
    }

    const ctx = context;
    const ctor = target as Function;
    const tableName = options?.name || ctor.name;

    // Register entity immediately
    MetadataStorage.addEntity(ctor, tableName);

    // Collect orphaned metadata (from field decorators that couldn't use addInitializer)
    if ((globalThis as any).__tsLinqOrphanedColumns) {
      const orphans = (globalThis as any).__tsLinqOrphanedColumns || [];
      for (const columnMeta of orphans) {
        MetadataStorage.addColumn(ctor, columnMeta);
      }
      (globalThis as any).__tsLinqOrphanedColumns = [];
    }
    
    if ((globalThis as any).__tsLinqOrphanedPrimaryKeys) {
      const orphanedPKs = (globalThis as any).__tsLinqOrphanedPrimaryKeys || [];
      for (const pk of orphanedPKs) {
        MetadataStorage.addPrimaryKey(ctor, pk);
      }
      (globalThis as any).__tsLinqOrphanedPrimaryKeys = [];
    }
    
    if ((globalThis as any).__tsLinqOrphanedRelationships) {
      const orphanedRels = (globalThis as any).__tsLinqOrphanedRelationships || [];
      for (const rel of orphanedRels) {
        MetadataStorage.addRelationship(ctor, rel);
      }
      (globalThis as any).__tsLinqOrphanedRelationships = [];
    }
    
    if ((globalThis as any).__tsLinqOrphanedIndexes) {
      const orphanedIndexes = (globalThis as any).__tsLinqOrphanedIndexes || [];
      for (const idx of orphanedIndexes) {
        MetadataStorage.addIndex(ctor, idx);
      }
      (globalThis as any).__tsLinqOrphanedIndexes = [];
    }

    // Use addInitializer to collect metadata from WeakMap registry
    if (ctx.addInitializer) {
      ctx.addInitializer(() => {
        const registry = (globalThis as any).__tsLinqPendingMetadata;
        
        if (registry) {
          // Collect columns
          if (registry.columns?.has(ctor)) {
            const columns = registry.columns.get(ctor) || [];
            for (const col of columns) {
              MetadataStorage.addColumn(ctor, col);
            }
            registry.columns.delete(ctor);
          }
          
          // Collect primary keys
          if (registry.primaryKeys?.has(ctor)) {
            const pks = registry.primaryKeys.get(ctor) || [];
            for (const pk of pks) {
              MetadataStorage.addPrimaryKey(ctor, pk);
            }
            registry.primaryKeys.delete(ctor);
          }
          
          // Collect relationships
          if (registry.relationships?.has(ctor)) {
            const rels = registry.relationships.get(ctor) || [];
            for (const rel of rels) {
              MetadataStorage.addRelationship(ctor, rel);
            }
            registry.relationships.delete(ctor);
          }
          
          // Collect indexes
          if (registry.indexes?.has(ctor)) {
            const indexes = registry.indexes.get(ctor) || [];
            for (const idx of indexes) {
              MetadataStorage.addIndex(ctor, idx);
            }
            registry.indexes.delete(ctor);
          }
        }
      });
    }

    return;
  };
}
