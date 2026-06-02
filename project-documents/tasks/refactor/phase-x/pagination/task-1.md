---
status: not-started
phase: phase-x
package: pagination
priority: P2
effort: M
risk: medium
category: architecture
depends_on: []
related: []
---

# Refactor: Decide the fate of the placeholder `@ts-linq/pagination` package

## Problem

`@ts-linq/pagination` is a placeholder: it exports a single `PagedResult<T>`
interface and contains no implementation, no runtime dependencies, and has zero
importers anywhere in the monorepo. The actual pagination logic lives in
`@ts-linq/query`. The package therefore advertises a responsibility it does not
own, and its one exported type contradicts the real return shapes. This is an
*architecture decision* task, not a mechanical refactor: the package must either
become real or be retired, and the choice must be made before code moves.

## Evidence

- `packages/pagination/src/index.ts` — the entire source: an 8-line
  `PagedResult<T>` interface, nothing else.
- No importers: repo-wide search for `@ts-linq/pagination` and `PagedResult`
  outside the package returns no consumers.
- Real implementation lives elsewhere:
  - `packages/query/src/PaginationBuilder.ts:28` `paginate(...)`,
    `:41` `keysetPaginate(...)`.
  - `packages/query/src/TypedQueryable.ts:167` `paginate`, `:184`
    `keysetPaginate`.
  - Surfaced on `DbSet` (`orm/src/DbSet.ts:680 paginate`, `:688 keysetPaginate`).
- Type mismatch: placeholder `{ data, page, pageSize, total, totalPages }` vs the
  actual `paginate` return `{ items, total, page, size }` and `keysetPaginate`
  return `{ items, pageSize, nextAfter }`.
- `package.json` is `2.0.0-alpha.1`, `private`, no `dependencies`, **no `exports`
  field**.
- Tests assert nothing about this package's code:
  `tests-new/PagedResult.test.ts` only type-checks object literals;
  `tests-new/PropertyBasedKeysetPagination.test.ts` re-models keyset pagination
  in-memory and never imports the package.

## Why this is bad

- **Misleading ownership:** the package name promises pagination; maintainers are
  sent to the wrong place. Split responsibility violates cohesion.
- **Dead surface:** an exported, versioned type that nobody uses and that
  contradicts the real API increases confusion and changeset noise.
- **Inconsistent result types:** three different "page" shapes (`PagedResult`,
  `paginate` result, `keysetPaginate` result) with no canonical type.
- **Hygiene:** alpha version + missing `exports` map diverge from sibling
  packages.

## Target architecture

Pick one and apply Clean Architecture cohesion (one responsibility, one home):

- **Option A — Promote (make it real).** Move `PaginationBuilder` (or its pure
  paging algorithms) and a *unified* result-type family into
  `@ts-linq/pagination`:
  - `OffsetPage<T> = { items: T[]; total: number; page: number; size: number }`
  - `KeysetPage<T, K> = { items: T[]; pageSize: number; nextAfter: K | null }`
  - Deprecate/replace the divergent `PagedResult<T>`.
  - `@ts-linq/query` depends on `@ts-linq/pagination` and delegates. Add an
    `exports` map. Verify no dependency cycle (`query` must not already be a dep
    of `pagination`).
- **Option B — Retire (delete).** The package is private, alpha, and unused.
  Remove it from the workspace; keep pagination owned by `@ts-linq/query`
  (where it functions today). Migrate the property-based test into `query` so the
  coverage is not lost.

Recommendation: **Option B** unless there is a roadmap reason to extract paging as
a standalone consumable — the implementation already lives cohesively in
`@ts-linq/query`, and there are no consumers to serve. Promote only if pagination
is intended to be independently versioned/published.

## Proposed refactor

For the chosen option:

- **B (retire):** confirm zero importers; remove `packages/pagination` from
  `pnpm-workspace`/turbo config; delete the directory; move the keyset
  property-based test into `@ts-linq/query`'s suite (importing the real
  function); add a changeset noting removal of the (unused, private) package.
- **A (promote):** create the unified types, move the builder, repoint `query`
  imports, add the package `exports` map and a `dependencies` entry in `query`,
  run `arch:cycles`/`arch:deps`, and add a changeset.

## Suggested design patterns

- **Cohesion / single responsibility** — pagination logic lives in exactly one
  package.
- **Unified value objects** (`OffsetPage`/`KeysetPage`) — one canonical paging
  result shape instead of three divergent ones (extensibility for future paging
  modes).
- **Adapter (Option A only)** — `query` delegates to `pagination` without changing
  its public `Queryable.paginate`/`keysetPaginate` signatures.

## Testing plan

- **Decision artifact:** record the chosen option + rationale in this file's Notes
  and in `project-documents/tasks/dev-plans/README.md`.
- **Option B:** CI confirms no broken imports after removal; the migrated
  property-based test runs in `query`.
- **Option A:** unit + property-based tests against the moved implementation;
  contract tests for `OffsetPage`/`KeysetPage`; regression for
  `Queryable`/`DbSet` paging callers; `arch:cycles` clean.

## Acceptance criteria

- [ ] A documented decision (promote vs retire) with rationale.
- [ ] If retired: package removed, workspace/turbo config updated, keyset test
      migrated to `query`, changeset added, no broken imports.
- [ ] If promoted: paging implementation + unified result types live in
      `@ts-linq/pagination`; `query` delegates; `exports` map added; no dep cycle;
      changeset added.
- [ ] No divergent `PagedResult` shape remains contradicting the real API.
- [ ] `pnpm build && pnpm arch:deps && pnpm arch:cycles` pass.

## Refactor order

1. Confirm zero external/published consumers (this is a `private` package).
2. Make and document the decision.
3. Execute the chosen option behind passing builds.

## Notes

Because the package is `private: true` and `2.0.0-alpha.1` with no importers,
retirement carries essentially no runtime risk. The "medium" risk rating reflects
the workspace/config surgery and the need to not lose the existing property-based
keyset coverage, not consumer impact.
