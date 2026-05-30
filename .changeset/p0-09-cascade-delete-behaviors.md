---
"@ts-linq/orm": minor
"@ts-linq/migrations": minor
---

Implement P0-09: Cascade Delete Behaviors with all seven EF Core modes

- Add `deleteBehaviorToSql()` mapping `DeleteBehavior` enum to SQL `ON DELETE` clause strings
- Populate `foreignKeys` in `SchemaSnapshotBuilder.buildExpectedFromMetadata()` from relationship metadata, including the correct `ON DELETE` clause per dialect
- Add FK comparison to `SchemaComparator.compareSchemas()` so FK creates/drops appear in migration diffs
- Add `CascadeWalker` — client-side graph walker that applies `Cascade`, `ClientCascade`, `SetNull`, `ClientSetNull` behaviors on tracked entities before `saveChanges()` commits
- Integrate `CascadeWalker` into `ChangeTracker.applyCascades()` and invoke it in `DbContext.saveChanges()` after `detectChanges()`
- Export `CascadeWalker`, `deleteBehaviorToSql`, and `buildCreateTableSql` from their respective package public APIs
