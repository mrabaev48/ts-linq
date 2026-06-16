---
status: completed
phase: phase-x
package: orm
priority: P0
effort: XL
risk: high
category: architecture
depends_on: []
related: ["task-2.md", "task-4.md", "task-5.md"]
---

# Refactor: Decompose the `DbContext` god class

## Problem

`packages/orm/src/DbContext.ts` is a 1094-line god class that concentrates the
entire unit-of-work lifecycle. A single class is simultaneously responsible for:

- **Construction / options application** — `constructor` (lines 103–245) wires
  ~15 collaborators (provider, change tracker, entity loader, validation service,
  4 commands, SP executor, cache coordinator, audit + soft-delete interceptors,
  interceptor registry, model builder) and inlines cache/performance defaulting
  (lines 146–219).
- **DbSet factory + identity** — `set` (272), `defineSet` (312),
  `initializeDbSets` (823), `buildDbSetContext` (804).
- **Save pipeline** — `saveChanges` (365–468) interleaves: auto-detect, cascades,
  Hi-Lo prefill, default prefill, validation, the `savingChanges` interceptor
  loop, transaction open/commit/rollback, batch-vs-SP-vs-per-row routing
  (405–433), skip-navigation join writes (436–437), cache invalidation,
  `acceptAllChanges`, the `savedChanges` loop, and `OptimisticConcurrencyError`
  → `DbUpdateConcurrencyException` translation.
- **Per-row DML** — `processChange` (1003), `applyInsert/applyUpdate/applyDelete`
  (1036–1088) including entity-splitting fragment routing.
- **Value generation** — `prefillHiLoIds` (853), `prefillDefaults` (887), an
  inline Hi-Lo generator cache (`_hiLoGenerators`).
- **Transactions** — depth counter + `beginTransaction/commit/rollback`
  (509–561).
- **Lazy-loading facade** — `find`/`findAll`/`include`/`isLoaded` (723–792).
- **Lifecycle** — `dispose`, `reset`, `Symbol.asyncDispose`, pool return hook.
- **Misc** — `cache` object literal (564–610), normalization helpers (944–988).

Violated rules: Single Responsibility, Clean Architecture (no separation between
orchestration and mechanism), Clean Code (mega-method). This is the hottest path
in the framework and is effectively untestable without a fully wired provider.

## Evidence

- `DbContext.ts:103-245` — constructor wiring + inline defaulting.
- `DbContext.ts:365-468` — `saveChanges` mega-method.
- `DbContext.ts:405-433` — batch/SP/per-row routing branch.
- `DbContext.ts:853-942` — `prefillHiLoIds` + `prefillDefaults`.
- `DbContext.ts:1003-1088` — `processChange` + apply* fragment routing.
- 25+ private fields (lines 60–96), most `!`-asserted and mutated in the ctor.

## Why this is bad

- Any change to the save pipeline forces reasoning about transactions, caching,
  interceptors and value generation simultaneously.
- The class cannot be unit-tested in slices; every test needs the whole graph.
- High merge-conflict surface — most ORM features touch this one file.
- Constructor side effects (`mp.start?.()`, `provider.configure*`, model build,
  DbSet materialization) make instantiation non-deterministic and hard to mock.

## Target architecture

Apply SRP + Clean Architecture by extracting cohesive collaborators behind
interfaces, with `DbContext` reduced to a thin orchestrator (composition-first,
dependency inversion):

- **`DbContextBootstrapper`** (or `DbContextOptionsApplier`) — owns ctor wiring:
  takes `DbContextOptions`, produces a fully built `DbContextServices` value
  object (provider, registry, change tracker, loader, commands, executors,
  coordinators, interceptor registry, performance options). Removes side effects
  from the ctor.
- **`SaveChangesPipeline`** — owns the `saveChanges` body as an ordered sequence
  of injectable steps (DetectChanges → Cascade → PrefillIds → PrefillDefaults →
  Validate → SavingInterceptors → Execute → SkipNav → Invalidate → Accept →
  SavedInterceptors). Each step implements a `SaveStep` interface (Chain of
  Responsibility / Pipeline pattern).
- **`ChangeExecutor`** — owns `processChange` + batch/SP/per-row routing +
  fragment DML (the apply* methods). Depends only on commands, `SpExecutor`,
  `BatchExecutor`, registry.
- **`TransactionScope` / `UnitOfWork`** — owns the depth counter and
  begin/commit/rollback, decoupled from cache invalidation.
- **`DbSetRegistry`** — owns `set`/`defineSet`/`initializeDbSets`/
  `buildDbSetContext` and the auto-property naming convention.
- **`ValueGenerationService`** — owns `prefillHiLoIds`/`prefillDefaults` and the
  Hi-Lo generator cache.

`DbContext` keeps only: public surface (`set`, `saveChanges`, `entry`,
`find*`, transaction delegators, lifecycle) delegating to the above; plus the
`onModelCreating` hook.

## Proposed refactor

1. Introduce `DbContextServices` interface and a `DbContextBootstrapper` that
   builds it from options. Ctor becomes: `this._services = bootstrap(options)`.
2. Extract `SaveChangesPipeline` with a `SaveStep[]` and a `SaveContext` carrying
   the working set; move interceptor loops and transaction routing into steps.
3. Extract `ChangeExecutor` from `processChange`/`apply*`.
4. Extract `TransactionScope`; have the pipeline accept a scope instead of
   calling `this._provider.beginTransaction()` directly.
5. Extract `DbSetRegistry` and `ValueGenerationService`.
6. Keep all public method signatures byte-identical; only internals move.
7. Migration strategy: land the bootstrapper first (pure move), then the
   pipeline behind a feature-equivalent facade method, validating against the
   characterization tests at each step.

## Suggested design patterns

- **Pipeline / Chain of Responsibility** for `SaveChangesPipeline` — makes each
  save concern independently testable and reorderable (extensibility).
- **Facade** — `DbContext` becomes a facade over services (preserves public API).
- **Builder/Factory** — `DbContextBootstrapper` centralizes construction
  (removes ctor side effects, enables mock injection).
- **Value Object** — `DbContextServices`/`SaveContext` to pass state explicitly
  (no hidden `this` coupling; dependency inversion).

## Testing plan

- **Characterization (regression):** before any move, snapshot `saveChanges`
  behavior against `tests/stubs/TestProvider.ts` — affected-row counts, provider
  call order for insert/update/delete/batch/SP, transaction open/commit/rollback,
  cache invalidation calls. Reuse existing `tests-new/DbContext*.test.ts`.
- **Unit:** each extracted service in isolation with mocked collaborators.
- **Pipeline:** test step ordering and short-circuit (`savingChanges`
  suppression returns early).
- **Error-path:** `OptimisticConcurrencyError` → `DbUpdateConcurrencyException`
  translation preserved (see `tests/db-update-concurrency-exception.test.ts`).

## Acceptance criteria

- [ ] `DbContext.ts` reduced to a thin orchestrator (target < 350 LOC).
- [ ] `saveChanges` body lives in `SaveChangesPipeline`; no behavior change.
- [ ] Construction logic lives in `DbContextBootstrapper`; ctor has no inline
      defaulting branches.
- [ ] `processChange`/`apply*` live in `ChangeExecutor`.
- [ ] Transaction depth logic lives in `TransactionScope`.
- [ ] All existing `tests-new/` and `tests/` suites pass unchanged.
- [ ] Public API surface unchanged (verified by `test-d/index.test-d.ts`).
- [ ] `pnpm typecheck && pnpm lint && pnpm build` pass.

## Refactor order

1. Characterization tests.
2. `DbContextBootstrapper` + `DbContextServices`.
3. `DbSetRegistry` + `ValueGenerationService`.
4. `ChangeExecutor`.
5. `TransactionScope`.
6. `SaveChangesPipeline` (last; depends on 3–5).

## Notes

Coordinate with task-2 (catch reclassification in commit/rollback/dispose),
task-4 (ChangeTracker split feeds the pipeline), and task-5 (typed errors used by
the pipeline's concurrency-translation step).
