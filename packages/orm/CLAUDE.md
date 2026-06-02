# CLAUDE.md — @ts-linq/orm

## Role

The **top-level ORM** developers consume: `DbContext`, change tracking, `DbSet`, model builders,
value generators, pooling, transactions. Composes `core` + `query` + `metadata` + `migrations`.

## Hard boundaries

- Depends on `concurrency`, `core`, `metadata`, `metrics-safe`, `migrations`, `query`,
  `sql-visitor`, `telemetry`, `types`.
- Sits at the top of the runtime graph — nothing in the runtime depends back on `orm` (only test/
  integration/example packages do).

## Critical invariants & known hazards

- **God classes**: `DbContext` (~1094 LOC), `ChangeTracker` (~648), `DbSet` (~797),
  `EntityTypeBuilder` (~575). Add focused collaborators; don't grow them (refactor `task-1`/`task-3`/
  `task-4`, P0/P1).
- **No silent / commented-out catches in core paths** (`saveChanges`, change detection,
  transaction handling) — these have swallowed correctness errors (refactor `task-2`, P0).
- Change tracking uses snapshotting + value comparers from `metadata`; a converter without a
  matching comparer breaks dirty detection. Complex/owned/JSON values use dedicated comparers
  (`complexValueComparer`, `JsonSnapshotter`).
- `autoDetectChangesEnabled`, identity-map keying, and constructor/`onModelCreating` ordering are
  subtle — read existing code before changing lifecycle.
- Enforce a **public/internal boundary**: don't re-export internal collaborators from the barrel
  and freeze them as contract (refactor `task-6`).

## Public API surface & stability

- `src/index.ts` is the primary public contract for application developers — the most
  visibility-sensitive surface in the repo. Preserve fluent builder inference and chainability.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/orm/` (2× P0 + builders/tracking decomposition).

## Validation

```bash
pnpm --filter @ts-linq/orm typecheck
pnpm --filter @ts-linq/orm lint
pnpm --filter @ts-linq/orm build
```

Integration/e2e suites exercise this package heavily — but **never run integration/e2e tests in
the background** (they hang and must be killed manually). Run them in the foreground only.

## Do / Don't

- **Do** keep builder APIs strongly typed and chainable.
- **Do** throw typed exceptions (`DbUpdateConcurrencyException`, `KeylessMutationError`, …).
- **Don't** swallow errors in `saveChanges`/tracking.
- **Don't** grow the god classes or leak internals through the barrel.
