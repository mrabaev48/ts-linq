# P1-29: DbSet.Local, FindEntry, Find / FindAsync

**Status**: done  
**Package**: `@ts-linq/orm` only  
**Changeset**: `.changeset/local-view-find-p1-29.md` (minor bump)

---

## New Files

| File | Purpose |
|------|---------|
| `packages/orm/src/LocalView.ts` | `LocalView<T>` — observable in-memory view of tracked entities |
| `packages/orm/src/ChangeTrackerFacade.ts` | Subclass of `ChangeTracker` adding `findEntry<T>()` and `entries<T>()` |
| `packages/orm/tests-new/LocalViewFindEntry.test.ts` | 27 unit tests |
| `.changeset/local-view-find-p1-29.md` | Changeset |

---

## Modified Files

- `packages/orm/src/ChangeTracker.ts` — composite-PK index (`getPkTuple` replacing `getPkValue`), `_localViews` map, `getLocalView`, `findTrackedByPk`, `getTrackedForType`, LocalView notifications in all tracking methods
- `packages/orm/src/DbSet.ts` — added `local` getter, `find()`, `findAsync()`
- `packages/orm/src/DbContext.ts` — uses `ChangeTrackerFacade` instead of `ChangeTracker`
- `packages/orm/src/index.ts` — exports `LocalView`, `LocalViewChange`, `LocalViewChangeType`, `LocalViewListener`, `ChangeTrackerFacade`
- `project-documents/tasks/dev-plans/README.md` — P1-29 marked ✅ done
- `project-documents/tasks/dev-plans/P1-29-local-view-find.md` — frontmatter status: done

---

## Architecture Decisions

### Circular dependency avoidance — ChangeTrackerFacade pattern
`ChangeTracker` cannot import `EntityEntry` (EntityEntry imports ChangeTracker as `import type`, creating a cycle detected by dependency-cruiser). Solution: `ChangeTrackerFacade extends ChangeTracker` lives in a separate file and safely imports both. `DbContext` creates `ChangeTrackerFacade` and exposes it as `get changeTracker(): ChangeTrackerFacade`.

### Composite PK key canonicalization
`getPkTuple(entity, entityClass): string | undefined` builds a stable string key:  
```ts
JSON.stringify([...pks].sort().map(k => entity[k]))
```
Replaces the previous `getPkValue` (single-PK only). All internal PK map methods use the new tuple key.

### LocalView pub-sub
Pure in-process `Set<listener>` — no external dependencies. `subscribe()` returns an unsubscribe function. Notifications fire on `add/update/remove/attach/setState/acceptAllChanges/clear`. Lazy creation: `getLocalView(cls)` pre-populates from existing tracked entities.

### DbSet.findAsync fallback strategy
Uses `whereIn(pkCol, [value])` for each PK column (alphabetical order) chained on `newQueryable()`. Returns `firstOrDefault()`.

### ChangeTracker._provider visibility
Changed from `private` to `protected` to allow `ChangeTrackerFacade` to pass it to `EntityEntry` constructors.

---

## Public API (mirrors EF Core)

```ts
// DbSet
const local = context.posts.local;             // LocalView<Post>
const off = local.subscribe(ch => ...);        // returns unsubscribe fn
const arr = local.toArray();                   // Post[]
for (const p of local) { ... }                 // iterable

const post = context.posts.find(42);           // T | null (tracker-only)
const post2 = await context.posts.findAsync(42); // Promise<T | null>

// ChangeTracker
const entry = context.changeTracker.findEntry(Post, 42);   // EntityEntry<Post> | undefined
const entries = context.changeTracker.entries(Post);       // EntityEntry<Post>[]
```

---

## Validation Outcome
- `pnpm typecheck` — ✅ 31/31
- `pnpm lint` — ✅ 0 errors
- `pnpm test:unit` — ✅ 2953/2953 (incl. 27 new tests)
- `pnpm build` — ✅ 32/32
- `pnpm arch:deps` — ✅ no violations
- `pnpm arch:cycles` — ✅ no cycles
- `pnpm arch:dead` — ✅ clean
