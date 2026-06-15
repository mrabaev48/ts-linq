# refactor query/task-10: curate public barrel (FINAL query task)

✅ DONE — query's 10TH and LAST task. Query package now FULLY COMPLETE (1–10).

## What changed
- `packages/query/src/index.ts`: replaced 4× `export *` (Queryable/QueryBuilder/QueryModel/
  TypedQueryable) with **explicit named exports**. Removed `LruCache`/`LruCacheOptions` from the
  main barrel.
- Curated public **value** surface (17, guarded by snapshot test): CapturedQueryPlan, EF,
  IncludableQueryable, IncludeResolutionError, IncludeSubquery, InMemorySqlCache, OrderedQueryable,
  QueryModel, QuerySplittingBehavior, QueryTagError, Queryable, STREAMING_CHUNK_SIZE,
  SetPropertyCalls, TypedOrderedQueryable, TypedQueryable, sanitizeTag, typed.
  Plus type-only: QueryTagList, CompiledQueryFn, EfFunctions, IncludeResolutionError{Code,Details},
  KeySelector, NavigationProxy, NavElement, ISetPropertyCalls, SetterEntry.

## Moved off main barrel → `@ts-linq/query/internal` (tagged `@internal`)
- `QueryBuilder` (added to internal/index.ts; JSDoc reworded + `@internal`).
- `LruCache` + `LruCacheOptions` (added to internal/index.ts; both `@internal`-tagged).

## Scope decision (user-confirmed): STRICT acceptance criteria only
- `QueryModel` and `InMemorySqlCache` were borderline (NO external consumers) but **kept public**
  to minimize breaking surface. Candidates to move to `/internal` at next major (tech debt).

## Consumers migrated (test-only, → `@ts-linq/query/internal`)
- 9 files importing `QueryBuilder` from the **main** barrel: provider-postgres (3),
  provider-mysql (2), provider-mssql (3), integration-tests/01-query-provider (1).
- orm/src needed NO migration: it consumes only public symbols + already used `/internal` for
  QueryContext/EnhancedSqlCache/InMemoryCountCache.
- query's own tests import moved symbols via relative `../src/...` (unaffected).

## Wiring notes
- `/internal` subpath already existed (package.json exports + jest-config moduleNameMapper
  lines 19-20/56-57/121). No new subpath wiring needed.
- provider tsconfigs only `include: src/**` → test files NOT typechecked; jest mapper resolves
  `/internal` at runtime. integration-tests tsconfig maps `/internal` to dist `.d.ts`.

## Test added
`packages/query/tests-new/QueryPublicBarrel.test.ts` — asserts exact 17 value exports, internals
(QueryBuilder/LruCache) absent from main barrel, present on `/internal`. Mirrors
core's PublicSurface.test.ts. (Existing QueryablePublicApi.test.ts kept.)

## Validation (local)
typecheck ✅, lint ✅ (0 errors), test:unit ✅ (325 suites / 3394 tests), build ✅ (32/32),
arch:deps ✅ (no violations), arch:cycles ✅ (none), arch:dead ✅ (0 findings — no internal leak).
integration/e2e require Docker DBs (ports closed locally) → deferred to CI/manual, as prior
query tasks. Pure export refactor, zero runtime logic change; `/internal` resolution confirmed
via provider unit tests + build.

## Versioning
query major 3.1.1→4.0.0; orm dependent patch →4.1.2. Changeset consumed.

## NEXT
query package FULLY COMPLETE. Next refactor package = **transformer (step 9)** — now 🔄 In Progress.
