# refactor query/task-5: honest key-selector types ✅ DONE

query's 8th task (P1/M/medium). PR branch `audit-refactor/query-honest-selector-types`.

## Problem
Selector lambdas advertised `(entity: T) => T[keyof T]` — compiler accepted nested access
(`u => u.profile.city`) but runtime `Proxy` throws on >1 top-level prop → type lie, deferred to
prod. `thenInclude(selector: (nav: never) => unknown)` killed IntelliSense.

## What changed
- **`KeySelector<T, K extends keyof T = keyof T> = (entity: T) => T[K]`** added in
  `packages/query/src/extractKey.ts` (re-exported from query barrel). Adopted in
  `orderBy`/`orderByDescending`/`thenBy`/`thenByDescending` (`K | KeySelector<T,K>`) and
  `innerJoinOn`/`leftJoinOn` (now `<TOther, KL extends keyof T, KR extends keyof TOther>` with
  `(KL & string) | KeySelector<T,KL>`). Honest return type; nested-path selectors whose leaf type
  matches no top-level prop are rejected at compile time (runtime guard still backstops the rest).
- **`thenInclude` chain typing (full, user choice A)**: new exported class
  `IncludableQueryable<T, TNav>` (in `Queryable.ts`) returned by all `include(...)` overloads,
  threading the leaf nav entity type via `NavElement<X> = X extends ReadonlyArray<infer E> ? E :
  NonNullable<X>`. `IncludableQueryable.thenInclude` is a TWO-overload override: precise
  `<TProp>(selector: (nav: TNav) => TProp): IncludableQueryable<T, NavElement<TProp>>` FIRST (wins
  resolution, drives IntelliSense), then a second signature mirroring the base
  `(nav: never) => unknown): Queryable<T>` EXACTLY — required so the override stays assignable to
  `Queryable.thenInclude` (a narrower-param-only override is unsound and TS rejects it).
- **CRITICAL inference gotcha**: `include<K extends keyof T>(sel: (e:T)=>T[K])` does NOT reliably
  infer K from a lambda (indexed-access reverse inference falls back to `keyof T` → TNav became the
  `T[keyof T]` union). FIX: use direct return-type inference `include<TProp>(sel: (e:T)=>TProp):
  IncludableQueryable<T, NavElement<TProp>>` and same for thenInclude. String-key overload keeps
  `NavElement<T[K]>` (reliable, no lambda). Filtered overload → `IncludableQueryable<T, U>`.
  Base `Queryable.thenInclude((nav:never)=>unknown)` KEPT (runtime method + QueryablePublicApi
  snapshot lists it). KeySelector stays for ordering/join only (there K precision isn't needed
  downstream but it still rejects nested).
- **Unified extractor + one typed error**: `SelectorExtractionError` added to `@ts-linq/types`
  (`OrmErrorCode.SelectorExtraction = 'SELECTOR_EXTRACTION_ERROR'`, exported via barrel; manifest
  tests updated: `tests/type-exports.test.ts` expected-exports list, `src/__tests__/exports.check.ts`,
  `src/__tests__/errors.test.ts`). `extractKey.ts` is now the single Proxy extractor (try/catch +
  cause, 0→throw, >1→throw with `details.accessed`, message TEXT unchanged so `extractKey.test.ts`
  regexes stay green). `SetPropertyCalls.extractSingleProp` DELETED → routes through `extractKey`
  (setProperty now also rejects multi-segment).

## Mirroring
`@ts-linq/orm` `DbSet.ts` mirrors the same signatures (orderBy/orderByDescending/include/
innerJoinOn/leftJoinOn) and delegates to Queryable — MUST mirror or delegation fails typecheck
(`(e)=>T[keyof T]` not assignable to `(e)=>T[K]`). DbSet imports `IncludableQueryable, KeySelector,
NavElement` (type-only) from `@ts-linq/query`.

## Tests
- `packages/query/tests-new/selectorTypes.type.test.ts` — type-level via ts-jest (NOT
  `pnpm typecheck`, which excludes tests; ts-jest type-checks at `test:unit`). Named `*.type.test.ts`
  so jest testMatch `**/*.test.ts` runs it AND ts-jest enforces `@ts-expect-error`. Fixture leaf
  type `bigint` (no sibling match) so nested access is provably rejected.
- `extractKey.test.ts` extended with direct shared-helper unit tests + `instanceof
  SelectorExtractionError` + `details.accessed`.

## Changeset / versions
`@ts-linq/types` 4.4→4.5.0, `@ts-linq/query` 3.0→3.1.0, `@ts-linq/orm` 4.0.24→4.1.0 — all **minor**
(more precise types + new exports; full monorepo incl. integration/e2e compiles → no migration).

## Validation (ALL GREEN)
typecheck 32/32, lint 0 errors, test:unit 3382, test:integration 461 (Docker up), test:e2e 290,
build 32/32, arch:deps/cycles/dead clean. Script names are `test:unit`/`test:integration`/`test:e2e`
(NOT `tests:*`).

## Follow-ups / tech debt
- Nested-access rejection at type level is best-effort: if a nested leaf type coincides with a
  sibling top-level prop type, K may mis-infer but the runtime `extractKey` guard still throws.
- next query tasks = 9 (include proxy double-invoke), 10 (barrel hygiene, major bump).
