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
 * Registers the entity in MetadataStorage and collects pending field metadata
 * using addInitializer().
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
    MetadataStorage.addEntity(ctor, tableName, options?.schema);

    // Use addInitializer to collect pending metadata after class definition
    if (ctx.addInitializer) {
      ctx.addInitializer(() => {
        // Collect pending columns
        if ((globalThis as any).__tsLinqPendingColumns?.has(ctor)) {
          const pendingColumns = (globalThis as any).__tsLinqPendingColumns.get(ctor) || [];
          for (const columnMeta of pendingColumns) {
            MetadataStorage.addColumn(ctor, columnMeta);
          }
          (globalThis as any).__tsLinqPendingColumns.delete(ctor);
        }

        // Collect pending primary keys
        if ((globalThis as any).__tsLinqPendingPrimaryKeys?.has(ctor)) {
          const pendingPKs = (globalThis as any).__tsLinqPendingPrimaryKeys.get(ctor) || [];
          for (const propertyName of pendingPKs) {
            MetadataStorage.addPrimaryKey(ctor, propertyName);
          }
          (globalThis as any).__tsLinqPendingPrimaryKeys.delete(ctor);
        }

        // Collect pending relationships
        if ((globalThis as any).__tsLinqPendingRelationships?.has(ctor)) {
          const pendingRels = (globalThis as any).__tsLinqPendingRelationships.get(ctor) || [];
          for (const relationMeta of pendingRels) {
            MetadataStorage.addRelationship(ctor, relationMeta);
          }
          (globalThis as any).__tsLinqPendingRelationships.delete(ctor);
        }

        // Collect pending indexes
        if ((globalThis as any).__tsLinqPendingIndexes?.has(ctor)) {
          const pendingIndexes = (globalThis as any).__tsLinqPendingIndexes.get(ctor) || [];
          for (const indexMeta of pendingIndexes) {
            MetadataStorage.addIndex(ctor, indexMeta);
          }
          (globalThis as any).__tsLinqPendingIndexes.delete(ctor);
        }
      });
    }

    return;
  };
}
