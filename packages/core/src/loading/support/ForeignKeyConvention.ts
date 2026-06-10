import type { EntityCtorRef } from '@ts-linq/types';

/**
 * Single source of the foreign-key naming convention shared by every loader.
 *
 * Previously duplicated as `defaultForeignKeyFor` in both `EntityLoader` and
 * `RelationshipLoader`; extracted here so the convention is fixed in one place.
 */
export class ForeignKeyConvention {
  /**
   * Compute the default foreign-key property name for a target type using the
   * convention `camelCase(typeName) + 'Id'`, e.g. `User` -> `userId`.
   *
   * @param type An entity constructor reference. Falls back to `id` when the
   *   constructor has no usable `name`, matching the historical behaviour.
   */
  public defaultFor(type: EntityCtorRef): string {
    const name = (type as { name?: string }).name || 'id';
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    return `${camel}Id`;
  }
}
