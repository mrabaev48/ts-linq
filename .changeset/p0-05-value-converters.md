---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/query": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/dialect-postgres": minor
"@ts-linq/dialect-mysql": minor
"@ts-linq/dialect-mssql": minor
"@ts-linq/provider-postgres": minor
"@ts-linq/provider-mysql": minor
"@ts-linq/provider-mssql": minor
"@ts-linq/testkits": minor
---

feat(p0-05): add ValueConverter, ValueComparer and HasConversion fluent API

Adds bidirectional model↔provider value conversion (EF Core HasConversion parity):
- `ValueConverter<TModel, TProvider>` and `ValueComparer<T>` concrete classes in `@ts-linq/metadata`
- Built-in converters: `BoolToZeroOneConverter`, `EnumToStringConverter`, `EnumToNumberConverter`, `DateOnlyToStringConverter`
- `PropertyBuilder.hasConversion()` fluent overloads (converter instance or function pair + optional comparer)
- `ModelBuilder.properties<T>().haveConversion()` for global type-level converters
- `ChangeTracker.detectChanges()` uses `ValueComparer.equals/snapshot` for reference-type properties
- `RowMaterializer` applies `fromProvider` on read; all dialects and providers apply `toProvider` on write
- `BinaryVisitor` lifts converter to literals in WHERE predicates
- Bug fix: `MetadataRegistry.registerEntity` no longer overwrites finalized entities when called without a table name
