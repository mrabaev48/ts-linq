import { MetadataStorage } from '../metadata/MetadataStorage';
import type { IndexMetadata } from '../types';

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
      
      // Register entity immediately
      MetadataStorage.addEntity(target, tableName);
      
      // Initializer to restore metadata after clear()
      context.addInitializer?.(function (this: unknown) {
        const ctor = target as unknown as Function;
        // Recompute tableName to ensure correct value after clear
        const currentTableName = options?.name || ctor.name;
        const existing = MetadataStorage.getEntity(ctor);
        if (!existing) {
          MetadataStorage.addEntity(ctor, currentTableName);
        }
      });
      return;
    }

    // If not Stage-3, fail fast per project policy
    throw new Error('@Entity requires TS5 Stage-3 decorators');
  };
}
