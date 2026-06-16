# Refactor Audit: orm

## Package responsibility

`@ts-linq/orm` is the unit-of-work / context layer of the framework. It owns:

- `DbContext` — the unit-of-work root: DbSet factory, `saveChanges` pipeline,
  transaction depth bookkeeping, cache coordination wiring, interceptor wiring,
  per-context query-filter map, Hi-Lo / value-generator prefill, soft-delete /
  audit interceptor construction, lazy-loading facade, migration facade.
- `DbSet<T>` — typed entity set; mutation API (`add/update/remove`, ranges,
  upsert, bulk) plus a hand-forwarded mirror of the entire `Queryable<T>` surface.
- `ChangeTracker` / `ChangeTrackerFacade` — identity map + state machine + shadow
  values + collection snapshots + LocalView notification + change detection +
  graph traversal + cascade orchestration.
- Fluent model builders (`ModelBuilder`, `EntityTypeBuilder`, and ~20 sub-builders).
- Supporting services (`CacheCoordinator`, `AuditInterceptor`,
  `SoftDeleteInterceptor`, `ChangeValidationService`), commands
  (`InsertCommand`/`UpdateCommand`/`DeleteCommand`/`FragmentDmlExecutor`),
  save-changes executors (`BatchExecutor`, `SpExecutor`), value generators,
  pooling, factory.

## Current architectural problems

1. **`DbContext` is a god class (1094 LOC).** Constructor (lines 103–245) wires
   ~15 collaborators and inlines cache/performance defaulting; `saveChanges`
   (365–468) is a mega-method mixing interceptor pipeline, transaction routing,
   batch-vs-SP-vs-per-row dispatch, skip-nav join writes, cache invalidation and
   concurrency-exception translation. Untestable without a full provider.
2. **`DbSet` god-class regression by manual forwarding (797 LOC).** ~50 methods
   each `return this.newQueryable().<same-method>(...)`. Every new `Queryable`
   method must be copied by hand; drift is inevitable.
3. **`ChangeTracker` mixes six responsibilities (648 LOC):** identity map, state
   machine, shadow store, m2m collection diffing, change detection/equality, and
   graph traversal — all in one class with private deep-equality.
4. **Silent / commented-out catch blocks in core paths.** `commitTransaction`,
   `rollbackTransaction`, `dispose`, `cache.*` swallow errors with a
   `// logInternalError(...)` comment where logging was removed (DbContext:534,
   557, 607, 622; warmUp:574). DbSet `invalidateCountCache` (793) swallows
   silently. `ensureCreated` swallows constructor errors during pre-warm (339).
5. **Type-system bypasses.** Pervasive `as unknown as DbSet<T>` casts in the
   DbSet factory (DbContext:280, 290, 315, 319); `as unknown as this` Proxy is
   already gone (ISSUE-001 fixed) but the cast soup remains.
6. **Untyped error model.** Bare `throw new Error(...)` for "DbSet not
   configured" (276), no-PK upsert (758), missing context (181). Only two typed
   exceptions exist (`DbUpdateConcurrencyException`, `KeylessMutationError`) and
   neither carries an error code or structured context.
7. **`EntityTypeBuilder` (575 LOC)** accumulates ~25 unrelated feature axes and a
   178-line `_applyToRegistry` write-out — SRP pressure.
8. **Public API hygiene.** The main barrel re-exports save-changes executors
   (`batch-executor`, `batch-grouper`), `IdentityMap`, `InterceptorRegistry`,
   commands-adjacent internals, and HiLo generators with no `@internal`
   separation; `src/internal/index.ts` exists but is **not** mapped to a package
   `exports` subpath, so the intended internal boundary is unreachable/unused.

## Refactor goals

- Decompose `DbContext` into a thin orchestrator delegating to a `SaveChanges`
  pipeline, a `TransactionScope`/`UnitOfWork`, a `DbSetRegistry`, and a
  context-bootstrap/options-applier.
- Replace `DbSet`'s manual forwarding with composition over a shared queryable
  interface (or delegation), eliminating drift.
- Split `ChangeTracker` along its responsibility seams behind a stable facade.
- Introduce a typed ORM error hierarchy with codes, context and `cause`.
- Establish a real public/internal boundary via package `exports`.

## Recommended task order

| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-1.md — Decompose `DbContext` god class | P0 | ✅ Completed | Core hot path; blocks testability of everything else |
| 2 | task-2.md — Eliminate silent/commented catches in core paths | P0 | — | Data-loss / debugging hazard in commit/rollback/dispose |
| 3 | task-3.md — Replace `DbSet` manual Queryable forwarding | P1 | — | God-class regression; API drift risk |
| 4 | task-4.md — Split `ChangeTracker` responsibilities | P1 | — | Untestable multi-concern class on the save path |
| 5 | task-5.md — Introduce typed ORM error hierarchy | P1 | — | Bare `Error` throws; no codes/context |
| 6 | task-6.md — Public/internal API boundary via `exports` | P1 | — | Internals leak from barrel; `internal/` unreachable |
| 7 | task-7.md — Split `EntityTypeBuilder` config axes | P2 | — | SRP; large write-out method |
| 8 | task-8.md — Reduce `as unknown as` casts in DbSet factory | P2 | — | Type-safety erosion |

> **Package status: 🔄 In Progress** — task-1 ✅ done; tasks 2–8 pending.

## Dependencies on other packages

`@ts-linq/orm` depends on `core`, `metadata`, `query`, `types`, `metrics-safe`,
`migrations`, `sql-visitor`, `telemetry`, `concurrency`. It reaches into
`@ts-linq/query/internal` (`EnhancedSqlCache`, `InMemoryCountCache`) via a
tsconfig `paths` alias to `../query/dist/internal` — a deep-import boundary
crossing that bypasses the public entrypoint (see task-6).

## Testing strategy

- Characterize `saveChanges` with a stub provider before decomposition (golden
  master on affected-row counts + provider call order) so the split is behavior-
  preserving.
- Unit-test each extracted collaborator (pipeline, transaction scope, set
  registry) in isolation.
- Contract-test the `DbSet`↔`Queryable` surface to guarantee parity after the
  forwarding refactor.
- Error-path tests for every catch reclassified in task-2.

## Notes

The brief's "constructor returns a Proxy (`as unknown as this`)" item is **stale**
for current code: `DbContext` constructor no longer returns a Proxy and
`tests-new/DbContextProxy.test.ts` ("no Proxy from constructor (ISSUE-001)")
asserts this. The remaining concern is the `as unknown as` cast cluster in the
DbSet factory, captured as task-8.
