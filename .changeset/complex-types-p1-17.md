---
'@ts-linq/types': minor
'@ts-linq/orm': minor
'@ts-linq/sql-visitor': minor
'@ts-linq/migrations': minor
---

feat(P1-17): implement Complex Types — ComplexProperty value-object semantics without identity

Adds `complexProperty()` API mirroring EF Core 8's `ComplexProperty`. Complex type columns
are flattened into the owner table (e.g. `shippingAddress_street`), detected via deep-value
equality in ChangeTracker, and rewritten to flat column names in the SQL visitor.

New exports: `ComplexTypePropertyMetadata` (types), `ComplexTypeBuilder` (orm),
`ComplexAccessRewriter` (sql-visitor). `EntityMetadata.complexProperties` field added.
