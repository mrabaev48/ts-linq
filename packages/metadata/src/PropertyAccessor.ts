import { PropertyAccessMode } from './PropertyAccessMode';

/**
 * Abstracts reading and writing a single property on an entity instance.
 * Generated once per property at model-build time; hot paths call get/set directly.
 *
 * The `constructionSet` method is used during DB hydration (construction phase) and may
 * differ from `set` when mode is `FieldDuringConstruction`.
 */
export interface PropertyAccessor<T = unknown> {
  /** Read the property value from the entity. */
  get(entity: object): T;
  /**
   * Write the property value to the entity using the runtime access mode.
   * For mode=FieldDuringConstruction this is the POST-construction setter (public property).
   */
  set(entity: object, value: T): void;
  /**
   * Write the property value during DB hydration (construction phase).
   * For mode=Field or FieldDuringConstruction this writes directly to the backing field.
   */
  constructionSet(entity: object, value: T): void;
}

/**
 * Build a `PropertyAccessor` for the given property based on the configured access mode.
 *
 * TypeScript has no true "private field" reflection for `#field` syntax.
 * For the `_underscored` convention, Reflect.set/get with the field name key is sufficient.
 * For ECMAScript hard-private `#field`, the user must supply a custom accessor lambda via a
 * future `hasAccessor(get, set)` escape hatch (documented, not yet implemented).
 */
export function createPropertyAccessor<T>(
  propertyName: string,
  fieldName: string | undefined,
  mode: PropertyAccessMode
): PropertyAccessor<T> {
  const resolvedField = fieldName ?? `_${propertyName}`;

  switch (mode) {
    case PropertyAccessMode.Field: {
      return {
        get: (entity) => Reflect.get(entity, resolvedField) as T,
        set: (entity, value) => {
          Reflect.set(entity, resolvedField, value);
        },
        constructionSet: (entity, value) => {
          Reflect.set(entity, resolvedField, value);
        }
      };
    }

    case PropertyAccessMode.FieldDuringConstruction: {
      return {
        get: (entity) => Reflect.get(entity, propertyName) as T,
        set: (entity, value) => {
          Reflect.set(entity, propertyName, value);
        },
        constructionSet: (entity, value) => {
          Reflect.set(entity, resolvedField, value);
        }
      };
    }

    default: {
      // PropertyAccessMode.Property — default behaviour, same as before P1-32.
      return {
        get: (entity) => Reflect.get(entity, propertyName) as T,
        set: (entity, value) => {
          Reflect.set(entity, propertyName, value);
        },
        constructionSet: (entity, value) => {
          Reflect.set(entity, propertyName, value);
        }
      };
    }
  }
}

/** Default property-mode accessor used when no explicit mode is configured. */
export function defaultPropertyAccessor<T>(propertyName: string): PropertyAccessor<T> {
  return createPropertyAccessor<T>(propertyName, undefined, PropertyAccessMode.Property);
}
