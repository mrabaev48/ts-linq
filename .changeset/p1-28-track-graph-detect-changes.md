---
"@ts-linq/orm": minor
---

Add `trackGraph`, `autoDetectChangesEnabled`, `EntityEntry.state`, and `EntityEntry.isKeySet` (P1-28).

- `ChangeTracker.trackGraph(root, entityClass, callback)` — BFS walk over a detached entity graph; callback receives `EntityEntryGraphNode` with `entry.state` and `entry.isKeySet`, mirroring EF Core's `ChangeTracker.TrackGraph`.
- `ChangeTracker.autoDetectChangesEnabled` — set to `false` to skip the implicit `detectChanges()` call inside `saveChanges()` for bulk-update scenarios; call `detectChanges()` manually when ready.
- `EntityEntry.state` getter/setter — read or override the tracking state of an entity entry.
- `EntityEntry.isKeySet` — returns `true` when the entity's primary-key field holds a non-empty value; useful inside `trackGraph` callbacks to decide `Added` vs `Modified`.
