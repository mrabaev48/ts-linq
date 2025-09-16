import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { ColumnMetadata, RelationshipMetadata } from '../types';

/**
 * Options for configuring an entity/table.
 *
 * - name: Explicit table name. Defaults to the class name if omitted.
 */
export interface EntityOptions {
  name?: string;
}

/**
 * Class decorator that registers a class as a database entity (table).
 *
 * @param options Entity configuration options.
 * @returns A class decorator that records entity metadata.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    const tableName = options?.name || target.name;
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
