---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/query": minor
---

feat(P1-32): implement backing fields and property access mode

- Add `PropertyAccessMode` enum (`Property` | `Field` | `FieldDuringConstruction`) to `@ts-linq/metadata`
- Add `PropertyAccessor<T>` interface and `createPropertyAccessor` / `defaultPropertyAccessor` factory to `@ts-linq/metadata`
- Add `hasField(fieldName)` and `usePropertyAccessMode(mode)` to `PropertyBuilder` — mirrors EF Core's API
- Add entity-level `usePropertyAccessMode(mode)` to `EntityTypeBuilder` — default for all properties, overridable per-property
- Extend `ColumnMetadata` with `fieldName?`, `accessMode?`, `accessor?` fields
- Update `RowMaterializer` to call `accessor.constructionSet` during hydration — bypasses setter invariants when configured
- Update `ChangeTracker.hasChanged` and `cloneObject` to read property values through `accessor.get` / `accessor.set`
- Default behavior when only `hasField()` is provided: `FieldDuringConstruction` (hydration bypasses setter, user mutations go through setter)
- No breaking changes — all existing code defaults to `Property` mode (previous behavior)
