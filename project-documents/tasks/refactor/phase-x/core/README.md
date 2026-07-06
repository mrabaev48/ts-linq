# Refactor Audit: core

## Package responsibility
`@ts-linq/core` provides the foundational runtime abstractions of the ORM: the abstract
`DatabaseProvider` base (connection/CRUD/query/transaction/resilience contract), the
eager/lazy loading layer (`EntityLoader`, `RelationshipLoader`, `LazyLoadingProxy`),
decorators (`@Entity`/`@Column`/`@PrimaryKey`/relationships/validation), batch operations,
interceptor interfaces, owned-entity hydration, and value-object trees (spatial, hierarchy).
It depends on `@ts-linq/types`, `@ts-linq/metadata`, `@ts-linq/ast`, `@ts-linq/metrics-safe`.

## Current architectural problems
- **God class `DatabaseProvider`** (~1005 LOC) concentrating ~10 cross-cutting responsibilities behind one inheritance root (task-1).
- **Hidden singleton coupling**: the loading layer reads the process-wide `MetadataStorage` singleton directly, breaking documented per-context/multi-tenant isolation and testability (task-2).
- **God class + duplication in `EntityLoader`** (~592 LOC) with parallel single/batched paths and logic duplicated against `RelationshipLoader` (task-3).
- **Raw, string-interpolated SQL with injection surface** in `RelationshipLoader` junction reads — a dialect leak in the provider-agnostic package (task-4).
- **Silent-swallow / unsafe-fallback catch blocks** on hot CRUD/loading paths (`upsert`, `hydrateJson`, relationship load) (task-5).
- **Bare `throw new Error`** (22 sites) despite an existing typed error hierarchy (task-6).
- **`as unknown as` double-casts and `Record` punning** throughout loaders erode type safety (task-7).
- **Direct `console` logging + static logger global** bypass the logging abstraction (task-8).
- **Uncurated `export *` barrel** with documentation drift (task-9).
- **Duplicated non-dialect coercion tail** — `SqlHelper.ensureSqlParameter` and `query`'s `SetPropertyCalls` carry identical primitive/`bigint`/JSON/throw coercion tails that cannot reuse the `dialect-kit` canonical copy (boundary); residual DRY/drift risk (task-10, P3, optional follow-up from the coercion fail-fast sweep).

## Refactor goals
- Decompose the provider god class into injected, unit-testable collaborators.
- Invert metadata + logger dependencies (constructor injection, no global service locator).
- Make all SQL emission dialect-safe and parameterized; keep core provider-agnostic.
- Adopt a consistent typed-error + no-silent-swallow policy.
- Restore type safety in the loading layer.
- Curate the public API surface.

## Recommended task order
| Order | Task | Priority | Status | Reason |
|---:|---|---|---|---|
| 1 | task-4 | P0 | ✅ Completed | Self-contained SQL-injection/dialect-leak fix; ship first |
| 2 | task-2 | P0 | ✅ Completed | Inject `MetadataSource`; unblocks honest loader testing |
| 3 | task-6 | P1 | ✅ Completed | Typed errors (after types/task-2) before further refactor |
| 4 | task-5 | P0 | ✅ Completed | Silent-swallow/unsafe-fallback fixes on hot path |
| 5 | task-1 | P0 | ✅ Completed | Decompose `DatabaseProvider` god class (anchor) |
| 6 | task-3 | P1 | ✅ Completed | Split `EntityLoader`; remove loader duplication |
| 7 | task-7 | P1 | ✅ Completed | Remove `as unknown as` casts + centralize `Record` punning in the loading layer |
| 8 | task-8 | P2 | ✅ Completed | Logger injection / no console |
| 9 | task-9 | P2 | ✅ Completed | Curate barrel after structure settles |
| 10 | task-10 | P3 | ⬜ Not started | Optional: unify the non-dialect coercion tail (`SqlHelper` + `query/SetPropertyCalls`) into one `core` helper |

> **✅ The `core` package audit (tasks 1–9) is complete.** `task-10` is a later, optional **P3**
> follow-up filed during the coercion fail-fast sweep (the fail-fast fix already shipped in-place;
> task-10 only removes residual duplication) — it does not block anything.

> **task-4 (✅ Completed)** — junction reads now go through the provider capability
> `DatabaseProvider.queryJunction(spec: JunctionQuerySpec)`: every identifier is validated
> (`^[A-Za-z_][A-Za-z0-9_]*$`, fails closed with `InvalidIdentifierError`) and quoted via the
> dialect's `quoteIdentifier`; all values are bound as parameters. `packages/core/src/loading`
> now emits **zero** SQL text.
>
> **task-2 (✅ Completed)** — the loading layer no longer reaches into the global
> `MetadataStorage` singleton. `EntityLoader`, `RelationshipLoader`, and the
> `LazyLoadingProxy.create`/`createMany`/`preloadRelationships` entry points now take an injected
> `MetadataSource` port (reused from `@ts-linq/types`, implemented by `MetadataRegistry`).
> `DbContext` wires `options.registry ?? MetadataStorage.getInstance()` into the loaders, so
> per-context/multi-tenant isolation now extends to relationship loading. Backward compatibility is
> preserved via a `@deprecated` default param resolved by `core/src/defaultMetadataSource.ts`
> (the only loading-related reference to the singleton, kept out of `loading/*` — that directory
> has **zero** `MetadataStorage` imports). A new `EmptyMetadataSource` Null Object ships from
> `@ts-linq/metadata` for tests. Package remains 🔄 in progress (tasks 5, 1, 3, 7, 8, 9 pending).
>
> **task-6 (✅ Completed)** — all 22 bare `throw new Error(...)` sites in `packages/core/src`
> now raise the consolidated `@ts-linq/types` `OrmError` subclasses with a stable `code` and a
> safe-to-log `details` payload. No new error class/`OrmErrorCode` was needed (the `types/task-2`
> hierarchy already covered every case). Mapping: provider-sequence guard → `UnsupportedOperationError`;
> stream abort → `OperationAbortedError`; unknown include → `InvalidIncludeError`; index-builder
> validation → `ValidationError`; batch precondition guards → `MetadataError` / `BatchConfigurationError`.
> The seven duplicated "requires TS5 Stage-3 decorators" throws collapse into one
> `stage3DecoratorError(name)` factory (`core/src/decorators/decoratorErrors.ts`); the repeated batch
> metadata guards collapse into `core/src/batch/batchErrors.ts`. No parallel hierarchy was added to
> core; `@ts-linq/types` was not modified. Contract covered by `core/tests-new/TypedErrors.test.ts`
> (asserts `instanceof` + `code` + `details`, never message text). Package remains 🔄 in progress
> (tasks 5, 1, 3, 7, 8, 9 pending).
>
> **task-5 (✅ Completed)** — the invalid silent-swallow / unsafe-fallback catches on the hot
> CRUD and loading paths now surface typed failures. `DatabaseProvider.upsert` discriminates on
> the new typed `EntityNotFoundError` signal (update affecting zero rows) instead of catching
> *any* error to fall back to INSERT, so deadlocks / optimistic-concurrency / validation /
> connection errors propagate rather than spuriously inserting a duplicate. `OwnedEntityHydrator.
> hydrateJson` throws `OwnedEntityHydrationError` (with `cause` + safe context) on a corrupt JSON
> column instead of silently returning `undefined`. `EntityLoader.loadRelationshipByType`
> propagates a typed `RelationshipLoadError` so a failed relationship load is observable rather
> than a silently half-populated entity. Every remaining intentional swallow (logger isolation in
> `mergeLoggers`, `crossQuery` telemetry, stage-3 init) is routed through the single
> `logInternalError(context, error)` channel. The two valid recovery sites are preserved
> unchanged: the plan-stringify size-guard (`DatabaseProvider.maybeAnalyzeQuery`) and
> `logInternalError`'s own last-resort catch. Three new error classes/codes were added to
> `@ts-linq/types` (`EntityNotFoundError`, `OwnedEntityHydrationError`, `RelationshipLoadError`).
> The real providers override `upsert` with native MERGE/ON CONFLICT/ON DUPLICATE KEY and do not
> depend on the base catch-all, so no provider changes were required; their bare-`Error`
> zero-rows throw in `update` is a separate `@ts-linq/types` §16 follow-up (tech debt). Error-path
> coverage: `DatabaseProvider.upsert.test.ts`, updated `OwnedEntityHydrator*` and
> `EntityLoader.test.ts`. Package remains 🔄 in progress (tasks 1, 3, 7, 8, 9 pending).
>
> **task-1 (✅ Completed)** — the `DatabaseProvider` god class (~1056 LOC) is decomposed into
> eight injected, independently unit-tested collaborators; the base is now a thin facade
> (~674 LOC, ~432 non-comment) that declares the `do*` contract + public surface and **delegates**.
> Public `IDatabaseProvider` method signatures are byte-identical and the three provider packages
> compile with only the constructor/strategy-injection edits the user approved. Collaborators:
> `CompositeSqlLogger` (Composite — replaces the ~80-line static `mergeLoggers`),
> `ProviderConfig` (Parameter Object — collapses the 8-arg constructor and makes `providerName`
> required up front), `InterceptorDispatcher` (Observer/Mediator — the 4 interceptor arrays +
> ~14 `notify*` fan-out helpers), `QueryAnalyzer` (Strategy/Policy — `maybeAnalyzeQuery` sampling/
> rate-limit/EXPLAIN-timeout with injectable `now`/`random`/`sleep`), `QueryExecutionPipeline`
> (Template Method — `executeWithRetry` orchestration), `MiddlewareDispatcher` (Observer — the
> middleware fan-out), `BatchTransactionRunner` (the `insertMany`/`updateMany`/`upsertMany`
> transaction loop), and `SavepointStrategy`/`SequenceStrategy` (Strategy — ANSI default +
> per-dialect impls injected via `ProviderConfig`; the three providers stop overriding the
> savepoint/sequence methods, MySQL keeps one `runSavepointStatement` hook for its `pool.query`
> routing). The **`providerName='unknown'` latent bug is fixed**: providers pass the real name to
> `ProviderConfig`, so `ResilienceManager`/`HealthMonitor` are labelled correctly from
> construction. A `@deprecated` positional-arg constructor overload is kept for external
> back-compat. All collaborators adopt the typed `OrmError` hierarchy + `logInternalError`.
> Coverage: new unit tests for every collaborator
> (`CompositeSqlLogger`/`ProviderConfig`/`InterceptorDispatcher`/`QueryAnalyzer`/
> `QueryExecutionPipeline`/`MiddlewareDispatcher`/`BatchTransactionRunner`/strategy) plus
> per-dialect strategy tests in the provider packages; existing interceptor/savepoint/circuit
> contract tests pass unchanged. The literal `< 350 LOC` target was not fully reached — the
> residual ~432 lines are the irreducible provider contract (abstract CRUD/dialect declarations,
> public state accessors, streaming generator, junction read) plus the dual constructor; driving
> below 350 would fragment the contract itself and is noted as optional follow-up. Package remains
> 🔄 in progress (tasks 3, 7, 8, 9 pending).
>
> **task-3 (✅ Completed)** — `EntityLoader` (~628 LOC) is split into a thin orchestrator plus
> shared collaborators and a per-kind strategy registry. The genuinely-duplicated mechanics now
> live once under `core/src/loading/support/`: `ForeignKeyConvention.defaultFor` (was
> `defaultForeignKeyFor` in both loaders), `TargetEntityResolver.resolve` (was `resolveTargetEntity`
> in both), `InClauseChunker` (the IN()-chunk loop that was copy-pasted 3× in `EntityLoader` and
> absent in `RelationshipLoader`, routing `crossQuery` telemetry through the task-5
> `logInternalError` channel), `EntityGrouper` (group-by / index-by-key), and `ColumnResolver`
> (PK/column-name resolution). Per-kind loading moves behind a `RelationshipLoadStrategy` interface
> (`ToOneStrategy` for one-to-one + many-to-one, `OneToManyStrategy`, `ManyToManyStrategy`) dispatched
> by a `Map<relationship.type, …>` registry — **all `if (type === 'one-to-many')` / `switch` chains
> are gone** from both loaders. The `as unknown as { … }` relationship casts (and the
> `validateIncludes` metadata casts) are replaced by a typed `LoadableRelationship` view
> (`asLoadable`) derived from `RelationshipMetadata` — the **task-7 cast-removal overlap for the
> loading relationship view is done here** (the rest of task-7 was finished in the same PR — see
> the task-7 note below). **Decision (split + shared mechanics):** the two orchestrators stay
> separate — `EntityLoader` (eager, depth-recursive) and `RelationshipLoader` (lazy/proxy-aware:
> `wrapOne`/`wrapMany`/`markLoaded`) — because their lifecycles genuinely differ; every behavioural
> delta is captured in a lightweight per-call `RelationshipLoadContext` (proxy hooks, `markLoaded`,
> depth recursion, missing-value policy), so a **single** shared strategy set serves both without a
> merged class. Two improvements are folded in: `EntityLoader` now supports **many-to-many eager
> loading** (previously silently dropped via the to-one fallback) and `RelationshipLoader` gains
> **IN()-chunking** for free from the shared chunker → `@ts-linq/core` `minor`. N+1 batching and
> `populateFilteredRelationshipsMany` filter behaviour are unchanged (existing tests pass as-is);
> new coverage: `InClauseChunker`, `loaderSupport` (FK convention / target resolver / grouper /
> `asLoadable` + a type-level non-widening guard), `EntityLoader.manyToMany`, and
> `RelationshipLoader.chunking`. Package remains 🔄 in progress (tasks 8, 9 pending).
>
> **task-7 (✅ Completed)** — finished in the same PR as task-3 (both rewrite the same loader
> methods). `packages/core/src/loading/*` now contains **zero** `as unknown as` casts: the
> relationship-shape + `validateIncludes` casts were removed via the typed `LoadableRelationship`
> view (task-3), `TargetEntityResolver.resolve` collapses the thunk/ctor double-casts into a single
> `EntityCtor → new () => object` narrowing behind an `isThunk` type guard, and the unnecessary
> `LazyLoadingProxy` `entityClass` cast is dropped (`new () => T` is already assignable to
> `new () => object`). All scattered `(entity as Record<string, unknown>)[key]` punning across the
> loaders, strategies, and proxy traps is routed through one audited accessor —
> `loading/support/EntityRecord.ts` (`getProp`/`setProp`) — the single dynamic-access boundary.
> A new ESLint override (`no-restricted-syntax` on `TSAsExpression[typeAnnotation.type=
> 'TSUnknownKeyword']`, scoped to `packages/core/src/loading/**`) makes any reintroduced
> `as unknown` a hard error. Coverage: `tests-new/support/EntityRecord.test.ts` (read/write parity)
> plus the existing type-level non-widening guard. Internal type-safety only — no public API or
> runtime behaviour change (folds under the task-3 `minor`).
>
> **task-8 (✅ Completed)** — core no longer writes to the console by default; all internal
> logging routes through an injected sink with a silent **Null Object** default. `InternalLogger`
> drops the unconditional `console.error`: the unified `logInternalError(context, error)` channel
> (task-5) is preserved byte-for-byte and now dispatches to a single configurable global handler
> that defaults to **no-op** (`setInternalErrorHandler(handler?)` opts in; the host owns any console
> dependency — core ships no console handler). `LazyLoadingProxy`'s static mutable `_logger`
> (and `setLogger`/`getLogger`) is removed; the logger is injected as an optional trailing
> `LazyLoadingLogger` parameter on `create`/`createMany`/`preloadRelationships`
> (default = silent `NO_OP_LAZY_LOADING_LOGGER`), consistent with the task-2 `MetadataSource`
> injection direction — no hidden global logging state remains. The composition root opts in:
> `DbContext.include` adapts `options.logging`'s `SqlLogger` (via `provider.loggerRef`) into the
> lazy logger, so lazy-load warnings reach the attached logger when one is configured and stay
> silent otherwise. `grep -rn "console\." packages/core/src` (non-test) is now **empty**. Coverage:
> rewritten `InternalLogger.test.ts` (silent-by-default + injected-handler + never-throws),
> new `LazyLoadingProxy.logger.test.ts` (default-silent + injected-sink on the failure path), and
> updated isolation tests (`MiddlewareDispatcher`/`InterceptorDispatcher`/`CompositeSqlLogger`) that
> now assert the swallowed error reaches the installed handler instead of `console.error`.
> `@ts-linq/core` `minor` (new public `LazyLoadingLogger` type), `@ts-linq/orm` `patch`
> (lazy warnings now routed to the context logger). Package remains 🔄 in progress (task-9 pending).
>
> **task-9 (✅ Completed)** — the `@ts-linq/core` public barrel (`src/index.ts`) is curated: the
> intended public API is exported via **explicit named exports** instead of `export *`, so a new
> symbol added to a sub-module no longer silently becomes public API. The only surviving `export *`
> re-exports are the fully-public value-object sub-barrels `./spatial` and `./hierarchy` (every
> member is public; their own barrels are already curated — justified inline). The dead
> `// export * from './utils/InternalLogger'; // Removed` line is gone, and the inline
> "moved to package X" comments are consolidated into a single top-of-file module doc block.
> The 13 backward-compat `@ts-linq/types` re-exports (`EntityState` + 12 telemetry/tracking types)
> are now `@deprecated "import from @ts-linq/types"` so each type has one canonical path; the four
> in-repo `orm/src` consumers of `EntityState`/`TrackedEntity` are migrated to import from
> `@ts-linq/types` directly (orm tests left as-is — they exercise the back-compat path). No public
> symbol was dropped — `arch:dead` is clean and a new `tests-new/PublicSurface.test.ts` snapshots
> the exact runtime value surface (61 symbols) to fail on any future silent widening.
> `@ts-linq/core` `minor` (curated surface + deprecations), `@ts-linq/orm` `patch` (internal
> import-path move, no API change). **Follow-up (out of scope):** whether the `spatial`/`hierarchy`
> value-object trees deserve their own packages, hard-removal of the `@deprecated` core→types
> re-exports in a future major, and the `utils/RetryPolicies` → `@ts-linq/concurrency` facade
> (same canonical-path theme). **The `core` package refactor is now fully complete (tasks 1–9).**

## Dependencies on other packages
- `@ts-linq/types` — error hierarchy (`types/task-2`), `SqlDialect`/identifier quoting (task-4), metadata interfaces.
- `@ts-linq/metadata` — `MetadataSource` port (`metadata/task-1`) consumed by task-2.
- `@ts-linq/ast` — clean; potential target for declarative junction-read nodes (task-4 option b).

## Testing strategy
- Unit tests per extracted collaborator (analyzer, dispatcher, composite logger, load strategies, chunker) with fakes — newly possible once DI replaces singletons/statics.
- Provider-dialect tests for junction SQL quoting.
- Error-path tests for every formerly-swallowed catch and every typed-error replacement.
- Type-level tests guarding the removal of `as unknown as`.
- Regression: existing provider integration + N+1 batching tests must pass unchanged (public API stable).

## Notes
The earlier known-evidence that `SequenceRegistry` leaks into `core/loading` is **stale**:
the current tree shows `SequenceRegistry` is not imported anywhere under `packages/core/src`
(only `migrations` and `orm` use it). Spatial code in core does **not** emit WKT/SQL strings.
The AST package is clean. The single confirmed SQL leak in core is the `RelationshipLoader`
junction reads (task-4).
