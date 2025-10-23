import { MetadataStorage } from '@ts-linq/metadata';

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
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'class';
}

/**
 * Class decorator that registers a class as a database entity (table).
 * Field decorators (@Column, @PrimaryKey, etc.) register their metadata when
 * instances are created. @Entity just registers the entity/table name.
 * Requires TS5 Stage-3 decorators.
 */
export function Entity(options: EntityOptions = {}): ClassDecorator {
  return function <TFunction extends Function>(
    target: TFunction,
    context?: unknown
  ): TFunction | void {
    // TS5 Stage-3 path only
    if (isStage3ClassContext(context)) {
      const ctor = target as Function;
      const tableName = options?.name || ctor.name;
      
      // Register entity immediately
      // Field decorators will add their metadata when instances are created
      MetadataStorage.addEntity(ctor, tableName);
      
      return;
    }

    // If not Stage-3, fail fast per project policy
    throw new Error('@Entity requires TS5 Stage-3 decorators');
  };
}
