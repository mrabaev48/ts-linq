# refactor query/task-9: extract IncludeSelectorResolver

✅ DONE — query's 9th refactor task (P2/S/low-risk clean-code), branch
`audit-refactor/query-extract-include-selector-resolver` off main.

## What changed
- New `packages/query/src/IncludeSelectorResolver.ts`: a small, stateless, independently
  testable unit that drives the filtered-include `Proxy`.
  - `resolve(selector): IncludeResolution` invokes the selector **exactly once** against a
    proxy whose `get` returns `new IncludeSubquery(prop)`.
  - Discriminated result `IncludeResolution = { kind:'subquery'; value: IncludeSubquery<unknown> }
    | { kind:'error'; error: unknown }` (2-kind — user-confirmed; the old 3rd `property`/
    `extractKey` fallback was dead-on-success and is removed).
  - Thrown selector → `{ kind:'error', error }` carrying the **original** error object (no
    re-invocation). Non-`IncludeSubquery` result (literal / nested-path) → `{ kind:'error' }`
    with a typed `SelectorExtractionError` (from `@ts-linq/types`).
- `IncludeBuilder.resolveInclude` now consumes the resolver (field `selectorResolver` built in
  ctor): on `error` rethrows `resolution.error` directly; on `subquery` validates the key and
  returns `filtered` vs `simple` by `subquery.isFiltered`. Removed: inline `makeIncludeProxy`,
  the useless `try/catch (err){throw err}`, and the dead `extractKey` fallback.
  `extractKey` is still imported and used **only** in `resolveThenInclude` (single invocation).

## Context (prereqs)
- task-1 had already moved the include proxy from `Queryable` into `IncludeBuilder`.
- task-8 had already removed the original double-invocation + `return this; // unreachable`.
  task-9 formalized it into the named resolver + Result type and removed the remaining smells.

## Not exported from barrel
`IncludeSelectorResolver` / `IncludeResolution` are internal — NOT exported from
`src/index.ts`. Tests import from `../src/...` directly. → public surface unchanged → **patch**.

## Tests
- New `packages/query/tests-new/IncludeSelectorResolver.test.ts`: subquery (plain + filtered),
  original-error identity, forbidden-operator throw, literal→typed error, and exactly-once spy
  on all three paths (success / throw / non-nav).
- Regression green: `IncludeBuilder.test.ts`, `filteredInclude.test.ts`.

## Tech-debt confirmed
- No other call path double-invokes a user selector: only `resolveThenInclude` uses `extractKey`,
  a separate selector invoked once.
- The 2-kind union covers every include outcome the proxy actually produces.

## Validation (all green)
typecheck (32), lint (0 errors), unit 3390, integration 461 (+2 skip), e2e 290, build,
arch:deps (no violations), arch:cycles (none), arch:dead (clean for new symbols).

## Versioning
query 3.1.0 → 3.1.1 (patch) + orm internal-dependency patch; changeset consumed.

## Next
query task-10 (last in package): public API / barrel hygiene (major bump bundle).
