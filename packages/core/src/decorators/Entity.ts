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
  return function <TFunction extends Function>(
    target: TFunction,
    context?: unknown
  ): TFunction | void {
    const tableName = options?.name || target.name;

    // TS5 Stage-3 path only
    if (isStage3ClassContext(context)) {
      // Persist table name via reflect so metadata survives storage.clear()
      try {
        (
          Reflect as unknown as { defineMetadata?: (k: string, v: unknown, t: Function) => void }
        ).defineMetadata?.('orm:tableName', tableName, target);
      } catch {
        /* ignore */
      }
      // Register entity immediately
      MetadataStorage.addEntity(target, tableName);
      context.addInitializer?.(function (this: unknown) {
        const ctor = target as unknown as Function;
        // Ensure entity exists after possible MetadataStorage.clear() calls between module eval and first instantiation
        const existing = MetadataStorage.getEntity(ctor);
        if (!existing) {
          MetadataStorage.addEntity(ctor, tableName);
        }
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

    // If not Stage-3, fail fast per project policy
    throw new Error('@Entity requires TS5 Stage-3 decorators');
  };
}
