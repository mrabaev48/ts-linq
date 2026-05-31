---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/migrations": minor
---

feat(P0-13): add HasData model seeding with migration diff support

Implements EF Core-compatible `hasData(...rows)` on `EntityTypeBuilder<T>`. Seed rows are stored in `EntityMetadata`, included in `ModelSnapshot`, and diffed by primary key between snapshots to emit precise INSERT / UPDATE / DELETE statements in the same migration transaction as DDL. Topological sort ensures FK-safe apply order.
