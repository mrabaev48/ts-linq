/**
 * Controls how the ORM reads and writes an entity property at runtime.
 * Mirrors EF Core's `PropertyAccessMode` enum.
 *
 * - `Property`               — use the public getter/setter (default).
 * - `Field`                  — bypass the getter/setter; read/write the backing field directly.
 * - `FieldDuringConstruction`— use the backing field when hydrating (construction), the public
 *                              getter/setter for all subsequent reads.
 */
export enum PropertyAccessMode {
  Property = 'Property',
  Field = 'Field',
  FieldDuringConstruction = 'FieldDuringConstruction'
}
