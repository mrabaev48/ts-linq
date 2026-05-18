# ISSUE-008: `LazyLoadingProxy` and `BatchOperations` are new god modules in `@ts-linq/core`

## Severity

Medium

## Category

- SOLID (SRP)
- Maintainability
- Clean Code

## Location

- `packages/core/src/loading/LazyLoadingProxy.ts` — 752 LOC, single file
- `packages/core/src/batch/BatchOperations.ts` — 580 LOC, single file

## Problem

Audit v4 explicitly diagnosed god classes in the query and ORM layers (`Queryable`, `DbContext`, `DbSet`). It did not surface the comparable situation in `@ts-linq/core`. Two files dominate the package:

- `LazyLoadingProxy.ts` (752 LOC) — combines navigation-property lazy resolution, Proxy interception, request-coalescing / batching, and cache integration in one module. Its public surface mixes the runtime Proxy (the user-observable behaviour), the request-batching state (an optimisation), and metrics hooks. None of these are independently reusable, and none can be unit-tested in isolation without instantiating the whole proxy.
- `BatchOperations.ts` (580 LOC) — covers insert/update/delete batching, parameter chunking, IN-clause splitting, and provider-specific fan-out. The four operations have different correctness invariants but share state through this single module.

For comparison, `core` contains ~28 `.ts` files totalling ~3,994 LOC; these two files alone are 33% of the package. The next largest file in `core` is well under 300 LOC.

## Evidence

- `wc -l packages/core/src/loading/LazyLoadingProxy.ts` → 752.
- `wc -l packages/core/src/batch/BatchOperations.ts` → 580.
- `packages/core/src/` totals ≈ 3,994 LOC across 28 files (Explore agent survey).
- Audit v4 README explicitly notes: *"core circular dependency (ISSUE-001) fixed"* — the structural concern at that time was the *edge*, not the *node weight*. The node weight grew afterwards.

## Why It Matters

- **Maintainability**: Any change to lazy loading (cache key, prefetch policy, lifecycle hook) touches a 750-line file that handles four concerns simultaneously. Code review surface area is large; regressions are likely.
- **Testability**: Neither file decomposes into independently constructible units. To test "request coalescing", one has to spin up the whole Proxy with a fake provider; the coalescing logic itself cannot be tested without it.
- **Extensibility**: Adding a new loading strategy (e.g. cursor-based prefetch) requires either modifying `LazyLoadingProxy` or copy-pasting a parallel class — both are expensive.
- **Hidden coupling**: Because the modules are wide, downstream packages (`@ts-linq/orm`, `@ts-linq/query`) import "everything" rather than narrow services. ISSUE-006's "internal exports leakage" compounds with this — large modules produce large barrels.

## Recommended Fix

1. **Decompose `LazyLoadingProxy` along its concerns**:
   - `LazyProxyFactory` — owns Proxy creation and trap definitions.
   - `LoadCoalescer` — owns the per-context request batching state, time-window, dedup logic.
   - `LazyMetricsHook` — owns metrics emission so the proxy doesn't reach into the metrics module directly.
   - `LazyResolutionPolicy` — strategy interface for "when to load" (eager-after-first, hydrate-on-demand, etc.).
   The Proxy class itself shrinks to wiring + traps (< 200 LOC).

2. **Decompose `BatchOperations` per CRUD operation**:
   - `BatchInsert`, `BatchUpdate`, `BatchDelete`, `BatchUpsert` — one file each.
   - Shared helpers (`chunkParams`, `splitInClause`, `flushIfNeeded`) extracted to `_shared/`.
   - Public surface stays the same (a single facade method), but internals are independently testable.

3. **Track size in CI**. Add a custom `dependency-cruiser` rule that fails when a single file under `packages/core/src/` exceeds 400 LOC without an `@allow-large-file` marker. Mirrors how audit v4 used the same tool to catch `Queryable`.

## Acceptance Criteria

- No file in `packages/core/src/` exceeds 400 LOC.
- `LazyLoadingProxy.ts` is ≤ 200 LOC and delegates to ≥ 3 sibling modules.
- `BatchOperations.ts` is ≤ 200 LOC or removed in favour of per-operation modules.
- Each extracted class has at least one unit test in `packages/core/tests-new/`.
- `pnpm typecheck && pnpm test && pnpm arch:cycles` green; the new modules introduce no cycles.
