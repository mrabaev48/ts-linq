import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata, RelationshipMetadata, IndexMetadata } from '../types';

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
): x is { kind: 'class'; name?: string; addInitializer?: (fn: (this: unknown) => void) => void } {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'class';
}

/**
 * Class decorator that registers a class as a database entity (table).
 * Supports TS5 Stage-3 decorators and legacy decorators.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(target: TFunction, context?: unknown): TFunction | void {
    const tableName = options?.name || target.name;

    // TS5 Stage-3 path
    if (isStage3ClassContext(context)) {
      // Register entity immediately
      MetadataStorage.addEntity(target, tableName);
      context.addInitializer?.(function (this: unknown) {
        const ctor = target as unknown as Function;
        // Sync any reflect-stored columns/primaryKeys/relationships into MetadataStorage
        try {
          const cols = (Reflect.getOwnMetadata('orm:columns', ctor) as ColumnMetadata[]) || [];
          for (const col of cols) {
            MetadataStorage.addColumn(ctor, col);
          }
          const pks = (Reflect.getOwnMetadata('orm:primaryKeys', ctor) as string[]) || [];
          for (const pk of pks) {
            MetadataStorage.addPrimaryKey(ctor, pk);
          }
          const rels =
            (Reflect.getOwnMetadata('orm:relationships', ctor) as RelationshipMetadata[]) || [];
          for (const rel of rels) {
            const te = rel.targetEntity;
            const resolvedTarget =
              typeof te === 'function' && (te as { prototype?: unknown }).prototype
                ? (te as Function)
                : (te as () => Function)();
            MetadataStorage.addRelationship(ctor, { ...rel, targetEntity: resolvedTarget });
          }
          const idxs = (Reflect.getOwnMetadata('orm:indexes', ctor) as IndexMetadata[]) || [];
          for (const idx of idxs) {
            MetadataStorage.addIndex(ctor, idx);
          }
        } catch {
          /* ignore */
        }
      });
      return;
    }

    // Legacy decorators path: preserve previous behavior
    // Persist table name on the constructor for optional external rehydration
    Reflect.defineMetadata('orm:tableName', tableName, target);
    // Register entity metadata immediately
    MetadataStorage.addEntity(target, tableName);

    // Return lightweight subclass that re-registers metadata if storage was cleared
    const ExtendedClass = class extends (target as unknown as new (...args: unknown[]) => object) {
      constructor(...args: unknown[]) {
        super(...args);
        if (!MetadataStorage.getEntity(target)) {
          const tn =
            (Reflect.getOwnMetadata('orm:tableName', target) as string | undefined) || tableName;
          MetadataStorage.addEntity(target, tn);
          const columns = (Reflect.getOwnMetadata('orm:columns', target) as ColumnMetadata[]) || [];
          for (const col of columns) {
            MetadataStorage.addColumn(target, col);
          }
          const primaryKeys = (Reflect.getOwnMetadata('orm:primaryKeys', target) as string[]) || [];
          for (const pk of primaryKeys) {
            MetadataStorage.addPrimaryKey(target, pk);
          }
          const relationships =
            (Reflect.getOwnMetadata('orm:relationships', target) as RelationshipMetadata[]) || [];
          for (const rel of relationships) {
            const te = rel.targetEntity;
            const resolvedTarget =
              typeof te === 'function' && (te as { prototype?: unknown }).prototype
                ? (te as Function)
                : (te as () => Function)();
            MetadataStorage.addRelationship(target, { ...rel, targetEntity: resolvedTarget });
          }
        }
      }
    };
    // Let storage map back from Extended to original for getEntity lookups
    Reflect.defineMetadata('orm:original', target, ExtendedClass);
    return ExtendedClass as unknown as TFunction;
  };
}
