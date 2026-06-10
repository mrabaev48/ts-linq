# refactor/core/task-9 — Curate the `@ts-linq/core` public barrel (✅ DONE)

**Status:** Completed. **This completes the `core` package refactor — all tasks 1–9 done.**
Next package in strict order = `query` (step 8), now 🔄 In Progress.

## What changed
`packages/core/src/index.ts` rewritten from uncurated `export *` barrel → curated facade:
- **Explicit named exports** for the intended public API per sub-module (decorators, provider
  abstractions, loading, utils, owned-entity hydration, interceptors). A new symbol added to a
  sub-module no longer silently becomes public API.
- **`export *` kept only for `./spatial` and `./hierarchy`** (fully-public value-object sub-barrels;
  every member is public, their own barrels already curated — justified inline).
- **Removed** the dead line `// export * from './utils/InternalLogger'; // Removed`.
- **Consolidated** the inline "moved to package X" comments into a single top-of-file module doc
  block (metadata→@ts-linq/metadata, change-tracking/DbContext/DbSet→@ts-linq/orm,
  query-building→@ts-linq/query, migrations→@ts-linq/migrations).
- **Deprecated** the 13 backward-compat `@ts-linq/types` re-exports (`EntityState` + 12
  telemetry/tracking types: CacheInfo, CircuitEventInfo, CircuitState, ConnectionHealthInfo,
  ConnectionHealthStatus, FallbackInfo, QueryAnalysisInfo, QueryEndInfo, QueryStartInfo, RetryInfo,
  TrackedEntity, TransactionInfo) with `@deprecated "import from @ts-linq/types"`. Still compile →
  non-breaking; each type now has one canonical path.

## Consumer migration
The only in-repo consumers of the core→types duplicate path were `EntityState`/`TrackedEntity` in
`orm/src` (4 files: ChangeTracker.ts, LocalView.ts, changetracker/EntityEntry.ts,
changetracker/EntityEntryGraphNode.ts). Migrated to import from `@ts-linq/types` directly. orm
tests left as-is (exercise back-compat; deprecation is JSDoc-only, no eslint `no-deprecated` rule
exists so lint stays green). The other 11 deprecated types had zero in-repo core-path consumers.

## Curated public surface (61 runtime value exports)
Snapshotted in new `packages/core/tests-new/PublicSurface.test.ts` (`Object.keys(import * as core)`
sorted == inline expected array; type-only exports erased & intentionally not asserted). Guards
against future silent widening. Value exports: AnsiSavepointStrategy, CachePolicy, CircuitOpenError,
Column, DatabaseProvider, DdlBuilder, Entity, EntityCache, EntityLoader, EntityState,
ExponentialBackoffRetryPolicy, FixedIntervalRetryPolicy, HierarchyId, InterceptionResult,
LAZY_LOADING_{PROVIDER,PROXY,STATE,TARGET}, LazyLoadingProxy, LoadingStrategy, ManyToMany, ManyToOne,
MaxLengthOf, MinLengthOf, NoRetryPolicy, OneToMany, OneToOne, PatternOf, PrimaryKey, ProviderConfig,
QueryTrackingBehavior, RangeOf, RequiredIfOf, SqlHelper, UnsupportedSequenceStrategy, ValidIf,
ValidIfOf, awaitLazyLoad, create*/is* spatial fns, ctorName, getCachePolicy, getLazyTarget,
getPrometheusMetrics, hydrate{Json,OwnedEntities,TableSplit}, isLazyProxy, startPrometheusServer.

## Changeset
`@ts-linq/core` **minor** (curated surface + deprecations), `@ts-linq/orm` **patch** (import-path
move only). No public symbol dropped → not major. core 3.3.0→3.4.0, orm 4.0.16→4.0.17.

## Follow-ups (out of scope, captured)
- Whether `spatial`/`hierarchy` value-object trees deserve their own packages (larger call).
- Hard-removal of the `@deprecated` core→types re-exports in a future major once consumers migrate.
- `utils/RetryPolicies` is a deliberate back-compat facade re-exporting `@ts-linq/concurrency`
  (concurrency/task-1) — same canonical-path theme; left as-is, noted as future candidate.

## Validation outcomes (all green)
typecheck 32/32, lint 0 errors, unit 303 suites/3187, integration 87 suites/464, e2e 19 suites/290,
build 32/32, arch:deps no violations, arch:cycles none, arch:dead clean. (Script names are
`test:unit`/`test:integration`/`test:e2e`, NOT `tests:*`.)
