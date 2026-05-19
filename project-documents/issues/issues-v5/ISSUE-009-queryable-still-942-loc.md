# ISSUE-009: `Queryable` is still 942 LOC after audit v4's decomposition

## Severity

Low

## Category

- Clean Code
- Maintainability

## Location

- `packages/query/src/Queryable.ts` (942 LOC, single class `Queryable<T>`)

## Problem

Audit v4 ISSUE-003 reduced `Queryable` from 938 LOC / 55 methods to "~700 LOC" by extracting `FallbackManager`, `PaginationBuilder`, and `queryUtils.ts`. PR #66 then re-added lambda-selector overloads on `orderBy`, `thenBy`, `include`, `thenInclude`, `innerJoinOn`, `leftJoinOn` plus a Proxy-based `extractKey` helper, plus the `thenInclude` method itself — the file grew back to 942 LOC.

What remains in the file:

- Public query API (~30 chainable methods).
- The `extractKey` helper (lines 923-942) — see ISSUE-002.
- Join helpers (`packages/query/src/Queryable.ts:~900` area) that build the JOIN clause inline.
- Pagination cross-cuts that still take `this` and read internal fields directly even though `PaginationBuilder` exists.

In other words, the v4 decomposition extracted classes but did not migrate all relevant logic to them; the file accumulated new growth on top. Two follow-ups are warranted:

1. Extract `extractKey` to its own utility module (it has no dependency on `Queryable` state and is consumed across packages — see ISSUE-002's recommendation to share with `IncludePlanner`).
2. Move `innerJoinOn` / `leftJoinOn` body logic (table-name resolution, alias generation, ON-clause construction) into a `JoinBuilder` collaborator analogous to `PaginationBuilder`.

## Evidence

- `wc -l packages/query/src/Queryable.ts` → 942.
- `git log --all -- packages/query/src/Queryable.ts | head -20` shows the post-v4 ISSUE-003 fix and the subsequent PR #66 lambda-selector additions.
- `packages/query/src/index.ts` already exports `PaginationBuilder`, `FallbackManager`, `IncludePlanner` — the decomposition pattern exists; only `JoinBuilder` is missing.

## Why It Matters

- **Decomposition drift**: ISSUE-003 v4's recommendations were not load-bearing; the file is back to its original size within four months. A second pass without a structural change will produce the same drift again.
- **Cognitive load**: 942 LOC in one class with 30+ public methods is a discoverability problem; method search across the file is non-trivial.
- **Test ergonomics**: New tests for joins or pagination need to instantiate `Queryable` because the relevant logic lives there, not in the extracted collaborators.

## Recommended Fix

1. Extract `extractKey()` to `packages/query/src/internal/selectorPath.ts`. Export an internal-only helper (`getSelectorPath(selector): string` or `string[]`), consumed by `Queryable` and reusable by `IncludePlanner` / future `OrderedQueryable`.
2. Introduce `JoinBuilder` (in `packages/query/src/JoinBuilder.ts`) responsible for translating `innerJoinOn` / `leftJoinOn` calls into `QueryModel` join entries. `Queryable.innerJoinOn` becomes a 3-line forwarder.
3. Re-run `pnpm arch:cycles` to confirm no cycles introduced.
4. Add a `madge --max` style assertion or a `dependency-cruiser` rule capping `Queryable.ts` at ≤ 600 LOC.

## Acceptance Criteria

- `packages/query/src/Queryable.ts` is ≤ 600 LOC.
- `extractKey` is not defined inside `Queryable.ts` and is shared with `IncludePlanner` (closing part of ISSUE-002 as a side-effect).
- A `JoinBuilder` (or equivalent) owns join translation; `Queryable.innerJoinOn/leftJoinOn` are ≤ 5 lines each.
- `pnpm typecheck && pnpm test && pnpm arch:audit` green.
