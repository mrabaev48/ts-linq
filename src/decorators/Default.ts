import 'reflect-metadata';

/**
 * Property decorator to set a column default value (sugar for Column({ defaultValue })).
 * Usage: @Default(0)
 */
export function Default(value: unknown): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata('orm:default', value, target, propertyKey);
    const ctor = (target as { constructor: Function }).constructor;
    const existing: Record<string, unknown> = Reflect.getOwnMetadata('orm:defaults', ctor) || {};
    existing[propertyKey.toString()] = value;
    Reflect.defineMetadata('orm:defaults', existing, ctor);
    // Try to patch already-registered column metadata object (same reference used by builder)
    const cols: Array<{ propertyName: string; defaultValue?: unknown }> =
      (Reflect.getOwnMetadata('orm:columns', ctor) as Array<{
        propertyName: string;
        defaultValue?: unknown;
      }>) || [];
    const col = cols.find((c) => c.propertyName === propertyKey.toString());
    if (col && col.defaultValue === undefined) {
      col.defaultValue = value;
    }
  };
}
