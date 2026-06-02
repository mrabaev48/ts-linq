---
status: not-started
phase: phase-x
package: query
priority: P0
effort: XL
risk: high
category: architecture
depends_on: []
related: ["query/task-2.md", "query/task-3.md", "query/task-7.md"]
---

# Refactor: Decompose the `Queryable<T>` god class

## Problem
`packages/query/src/Queryable.ts` is **1812 LOC** and is the single most overloaded class
in cluster C2. It is the public, chainable query surface and simultaneously owns far too
many responsibilities:

- Query-intent accumulation (`where`, `whereIn`, `orderBy`, `take`, `skip`, `distinct`,
  `groupBy`, `union`/`unionAll`/`except`/`intersect`/`concat`, `withCte`) — lines 484-915,
  1559-1594.
- Join construction (`innerJoinOn`, `leftJoinOn`, private `_addJoinOn`) — lines 561-595,
  1697-1717.
- Include planning glue (`include`, `thenInclude`, `_addSimpleInclude`,
  `_validateIncludeProperty`, the inline filtered-include `Proxy`) — lines 1025-1159.
- Inheritance/polymorphism SQL (`ofType` with TPH/TPT/TPC branches that build raw SQL) —
  lines 857-904.
- Terminal operators (`toArray`, `first`, `firstOrDefault`, `single`, `singleOrDefault`,
  `any`, `count`, aggregates) — lines 1318-1556.
- Streaming (`asAsyncEnumerable`, `forEachAsync`, `toDictionaryAsync`) — lines 1191-1312.
- Bulk DML (`executeUpdate`, `executeDelete`) — lines 1607-1695.
- Count-cache orchestration incl. single-flight dedup, TTL, metrics emission, key
  building — lines 1398-1456.
- Tracking/identity-resolution (`asNoTracking`, `_applyTracking`, `_deduplicateByPk`) —
  lines 222-246, 441-477.
- Global-filter application glue (`applyGlobalFiltersToModel`, `prepareQueryModel`) —
  lines 516-543.
- Key extraction via `Proxy` (`extractKey` free function) — lines 1738-1760.
- Query tagging, splitting, temporal, raw-SQL source seeding — lines 248-439.
- Column-name resolution (`resolveColumnName`, `buildColumnResolver`) — lines 1458-1511.

The class has **~25 private fields** (lines 52-102) and a 12-parameter constructor
(lines 110-122). `clone()` must hand-copy every field (lines 177-220) — a maintenance
hazard: any new field silently breaks cloning unless the author remembers to update it.

## Evidence
- `wc -l packages/query/src/Queryable.ts` → 1812.
- Constructor signature `Queryable.ts:110-122` takes 11 positional optional params; the
  same list is duplicated in `clone()` (`:178-190`), `selectCompiled()` (`:739-745`) and
  `ofType()` (`:858-869`) — four call sites that must stay in lock-step.
- `_addJoinOn` builds raw `ON` SQL strings with hardcoded identifier formatting
  (`Queryable.ts:1714`).
- `ofType` builds raw discriminator/JOIN SQL inline (`Queryable.ts:880-901`).

## Why this is bad
- **SRP violation**: a single class mixes query DSL, SQL fragment construction, execution
  orchestration, caching, tracking and streaming. Each reason-to-change touches the same
  1800-line file, maximizing merge conflicts and regression surface.
- **Testability**: most behavior is reachable only through the full chain + a live
  provider; the join/ofType/include logic cannot be unit-tested in isolation.
- **OCP**: adding a new inheritance strategy, join kind, or terminal operator means editing
  the god class rather than extending a collaborator.
- **clone() fragility**: field-by-field copy is an open invitation to aliasing bugs (see
  `query/task-2.md`).

## Target architecture
Apply **composition-first** and **Single Responsibility**. `Queryable<T>` should become a
thin, immutable *facade* that holds an immutable `QueryModel` + a `QueryContext`
(provider, metadata, performance, tracking config) and delegates to focused collaborators:

- `JoinBuilder` — owns `innerJoinOn`/`leftJoinOn`/`_addJoinOn`; emits structured
  `JoinClause` objects (no raw SQL string assembly; defer to dialect — see
  `query/task-6.md`).
- `InheritanceQueryPlanner` — owns `ofType` TPH/TPT/TPC branching; returns model mutations
  as structured clauses.
- `IncludeBuilder` — owns `include`/`thenInclude`/validation/the filtered-include proxy
  (the planner that *executes* includes already exists as `IncludePlanner`).
- `TerminalExecutor` / `QueryRunner` — `toArray`/`first`/`single`/`any`; already partly in
  `QueryExecutor`, pull the remaining orchestration out of `Queryable`.
- `CountCoordinator` — count cache + single-flight + metrics (today inline at `:1398-1456`).
- `StreamingExecutor` — `asAsyncEnumerable`/`forEachAsync`/`toDictionaryAsync`.
- `TrackingCoordinator` — `_applyTracking`/`_deduplicateByPk`.
- A `QueryContext` value object replaces the 11-arg constructor (see `query/task-3.md`).

`Queryable` keeps the fluent methods but each becomes a one-liner that returns a new
`Queryable` wrapping a derived `QueryModel` (immutability — `query/task-2.md`).

## Proposed refactor
1. Introduce `QueryContext` (immutable struct) and migrate the constructor + `clone()` to
   copy a single context reference + the model (kills field-by-field copy).
2. Extract `JoinBuilder`, `InheritanceQueryPlanner`, `IncludeBuilder`,
   `CountCoordinator`, `StreamingExecutor`, `TrackingCoordinator` as standalone,
   constructor-injected classes (Dependency Inversion: `Queryable` depends on their
   interfaces, not concretions).
3. Move raw-SQL assembly out of `ofType`/`_addJoinOn` into the dialect layer
   (cross-package; tracked separately in `query/task-6.md`).
4. Keep the public API byte-for-byte identical; this is an internal decomposition.
5. Migrate incrementally: one collaborator per PR, each with its own unit tests, so the
   god class shrinks monotonically and review stays tractable.

## Suggested design patterns
- **Facade** — `Queryable` presents one fluent surface over many collaborators. *Why*:
  preserves ergonomics while shrinking each unit.
- **Builder** — `JoinBuilder`/`IncludeBuilder` accumulate structured clauses. *Why*:
  isolates clause construction + makes it unit-testable.
- **Strategy** — `InheritanceQueryPlanner` selects TPH/TPT/TPC behavior. *Why*: OCP for new
  inheritance strategies.
- **Value Object** — `QueryContext`. *Why*: removes the 11-arg constructor and
  lock-step `clone()`.

## Testing plan
- **Unit**: each extracted collaborator gets isolated tests (JoinBuilder produces correct
  `JoinClause` for string vs lambda keys; InheritanceQueryPlanner for each strategy;
  CountCoordinator single-flight dedup; TrackingCoordinator dedup-by-PK).
- **Regression**: keep the existing `Queryable.test.ts` green throughout — it is the
  behavioral contract.
- **Contract**: snapshot the public method list of `Queryable` before/after to prove no
  API drift.

## Acceptance criteria
- [ ] `Queryable.ts` reduced to a thin facade (< 600 LOC target).
- [ ] No raw SQL string assembly remains in `Queryable` (`ofType`, `_addJoinOn` moved).
- [ ] `clone()` copies a single `QueryContext` + `QueryModel`, no per-field copy.
- [ ] Each extracted collaborator has dedicated unit tests.
- [ ] Existing `tests-new/Queryable.test.ts` passes unchanged.
- [ ] Public API surface unchanged (verified by export snapshot).

## Refactor order
1. `query/task-3.md` (QueryContext) — unblocks constructor/clone simplification.
2. `query/task-2.md` (immutability) — establishes the new-instance pattern collaborators rely on.
3. Extract collaborators one by one (this task).
4. `query/task-6.md` (raw SQL → dialect) in parallel where independent.

## Notes
This is the keystone task for the package; most other query tasks either unblock it or are
made easier once it lands. Split into multiple PRs — do **not** attempt as one change.
