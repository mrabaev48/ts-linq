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
 * Collects all orphaned field metadata and registers everything with MetadataStorage.
 * 
 * Uses "orphaned metadata pattern" to work around SWC 2022-03 limitations where:
 * - Field decorators cannot use addInitializer
 * - Returned initializer functions are not executed
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

    // Use addInitializer to collect orphaned metadata from field decorators
    // This runs AFTER all field decorators have executed
    if (ctx.addInitializer) {
      ctx.addInitializer(() => {
        // Collect orphaned columns
        if ((globalThis as any).__tsLinqOrphanedColumns) {
          const orphans = (globalThis as any).__tsLinqOrphanedColumns || [];
          for (const columnMeta of orphans) {
            MetadataStorage.addColumn(ctor, columnMeta);
          }
          (globalThis as any).__tsLinqOrphanedColumns = [];
        }
        
        // Collect orphaned primary keys
        if ((globalThis as any).__tsLinqOrphanedPrimaryKeys) {
          const orphanedPKs = (globalThis as any).__tsLinqOrphanedPrimaryKeys || [];
          for (const pk of orphanedPKs) {
            MetadataStorage.addPrimaryKey(ctor, pk);
          }
          (globalThis as any).__tsLinqOrphanedPrimaryKeys = [];
        }
        
        // Collect orphaned relationships
        if ((globalThis as any).__tsLinqOrphanedRelationships) {
          const orphanedRels = (globalThis as any).__tsLinqOrphanedRelationships || [];
          for (const rel of orphanedRels) {
            MetadataStorage.addRelationship(ctor, rel);
          }
          (globalThis as any).__tsLinqOrphanedRelationships = [];
        }
        
        // Collect orphaned indexes
        if ((globalThis as any).__tsLinqOrphanedIndexes) {
          const orphanedIndexes = (globalThis as any).__tsLinqOrphanedIndexes || [];
          for (const idx of orphanedIndexes) {
            // Only collect indexes that belong to this entity
            if (idx.ctor === ctor) {
              MetadataStorage.addIndex(ctor, idx.metadata);
            }
          }
          // Clear only the collected indexes
          (globalThis as any).__tsLinqOrphanedIndexes = orphanedIndexes.filter((x: any) => x.ctor !== ctor);
        }
      });
    }

    return;
  };
}
