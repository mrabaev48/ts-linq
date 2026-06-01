---
"@ts-linq/orm": minor
---

feat(P1-29): implement DbSet.local (LocalView<T>), DbSet.find/findAsync, ChangeTracker.findEntry/entries — adds observable in-memory view of tracked entities, O(1) PK-index lookup with composite PK support, and tracker-first / database-fallback FindAsync semantics mirroring EF Core
