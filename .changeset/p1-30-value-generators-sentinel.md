---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
---

feat(P1-30): Add value generators and sentinel (EF8)

Introduces pluggable client-side value generation and sentinel-based "not-set" detection, mirroring EF Core's `ValueGeneratedOnAdd` / `HasValueGenerator` / `HasSentinel` API.

- **`@ts-linq/types`**: New `ValueGeneratedPolicy` enum (`Never`, `OnAdd`, `OnUpdate`, `OnAddOrUpdate`), `ValueGenerator<T>` interface, `ValueGeneratorClass<T>` type, `ValueGeneratorContext` interface. Extended `ColumnMetadata` with `valueGeneratedPolicy`, `sentinel`, and `valueGeneratorClass` fields.
- **`@ts-linq/metadata`**: Re-exports all four new symbols from `@ts-linq/types`.
- **`@ts-linq/orm`**: Six new `PropertyBuilder<T>` methods — `valueGeneratedOnAdd()`, `valueGeneratedOnUpdate()`, `valueGeneratedOnAddOrUpdate()`, `valueGeneratedNever()`, `hasValueGenerator(cls)`, `hasSentinel(value)`. Three built-in generators — `UlidValueGenerator`, `UuidV7ValueGenerator`, `UtcNowValueGenerator`. `DbContext.prefillDefaults()` extended to invoke client-side generators before INSERT/UPDATE using sentinel-aware comparison. `BatchGrouper.calcParamsPerRow()` updated to correctly exclude DB-side generated columns from INSERT parameter lists.
