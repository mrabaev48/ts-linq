# @ts-linq/query

## 4.0.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.6.0
  - @ts-linq/ast@3.2.6
  - @ts-linq/core@3.4.4
  - @ts-linq/metadata@4.1.5
  - @ts-linq/metrics-safe@1.2.8
  - @ts-linq/sql-visitor@4.3.2

## 4.0.0

### Major Changes

- Curate the `@ts-linq/query` public barrel. `src/index.ts` now uses explicit named exports
  instead of `export *`, and internal collaborators are no longer part of the stable contract.

  **Breaking:** `QueryBuilder`, `LruCache`, and `LruCacheOptions` are no longer exported from
  `@ts-linq/query`. They live behind `@ts-linq/query/internal` (tagged `@internal`).

  Migration: if you genuinely need them (not recommended — they are implementation detail),
  import from `@ts-linq/query/internal`:

  ```ts
  // before
  import { QueryBuilder } from '@ts-linq/query';
  // after
  import { QueryBuilder } from '@ts-linq/query/internal';
  ```

  The intended public surface (`Queryable`, `OrderedQueryable`, `IncludableQueryable`,
  `TypedQueryable`, `QueryModel`, `EF`, error/selector types, etc.) is unchanged.

## 3.1.1

### Patch Changes

- Extract the filtered-include `Proxy` out of `IncludeBuilder` into a named, independently testable
  `IncludeSelectorResolver` that returns a discriminated `IncludeResolution` (`subquery | error`).
  The include selector lambda is now invoked exactly once on every path, the original thrown error
  object is rethrown directly (no re-invocation), and the dead `extractKey` fallback / useless
  `try/catch` are removed. Internal clean-up only — no public API change.

## 3.1.0

### Minor Changes

- Make key-selector lambda types honest about the single-property runtime contract.

  The fluent selector lambdas previously advertised `(entity: T) => T[keyof T]`, which the compiler
  accepted for nested access (`u => u.profile.city`) even though the runtime `Proxy` throws on
  anything beyond a single top-level property — a type lie whose failure was deferred to production.
  - **`@ts-linq/query` / `@ts-linq/orm`**: `orderBy`, `orderByDescending`, `thenBy`,
    `thenByDescending`, `innerJoinOn`, `leftJoinOn` now use a precise `KeySelector<T, K>` so the
    inferred key `K` is the specific property and the return type is its real value type; nested-path
    selectors whose leaf type matches no top-level property are now rejected at compile time.
    `include(...)` returns a new `IncludableQueryable<T, TNav>` that threads the leaf navigation entity
    type, so the subsequent `thenInclude(...)` selector is type-checked against the actual nested
    entity (restoring IntelliSense) instead of the previous `(nav: never) => unknown`. New exports:
    `KeySelector`, `NavElement`, `IncludableQueryable`.
  - **`@ts-linq/types`**: new `SelectorExtractionError` (`OrmErrorCode.SelectorExtraction`). The two
    Proxy-based selector extractors (`extractKey` and `SetPropertyCalls`) are unified into one helper
    with a single, fail-closed, typed error model (message text unchanged).

  These are more precise types over the prior looser signatures; the full monorepo (including
  integration and e2e suites) compiles unchanged, so no migration is required for valid existing code.

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.5.0
  - @ts-linq/ast@3.2.5
  - @ts-linq/core@3.4.3
  - @ts-linq/metadata@4.1.4
  - @ts-linq/metrics-safe@1.2.7
  - @ts-linq/sql-visitor@4.3.1

## 3.0.0

### Major Changes

- Split `QueryBuilder` into a cache-agnostic `SqlCompiler` core, a pure `CacheKeyBuilder`, and a `CachingSqlCompiler` decorator (`QueryBuilder` is now a thin facade over these). Removed the deprecated no-op static methods `QueryBuilder.clearCache`, `QueryBuilder.disposeCache`, and `QueryBuilder.invalidateForEntity` — use the instance methods (`clearCache()`, `dispose()`, `invalidateForEntity()`) or `DbContext` cache APIs instead.

## 2.5.1

### Patch Changes

- refactor(query): decompose the `Queryable<T>` god class into focused collaborators

  Internal decomposition only — the public fluent API is byte-for-byte unchanged (verified by a
  prototype snapshot test). `Queryable<T>` is now a thin immutable facade over `QueryModel` +
  `QueryContext` that delegates to 10 single-responsibility, constructor-injected collaborators:
  `TrackingCoordinator`, `CountCoordinator`, `StreamingExecutor`, `SetOperationBuilder`,
  `BulkDmlExecutor`, `QueryRunner`, `JoinBuilder`, `InheritanceQueryPlanner`, `PredicateBuilder`,
  `IncludeBuilder` (plus the shared `extractKey` helper). Each collaborator has dedicated unit tests.

  `Queryable.ts` shrank from 1930 → 1441 LOC (code lines 1168 → 777). The remaining size is the
  public JSDoc (≈573 lines) that must stay on the facade for IntelliSense/discoverability, so the
  original "< 600 LOC" target is reframed as "< ~450 facade code lines beyond the public contract";
  no public documentation was removed. No behavioral change; no new exported types.

## 2.5.0

### Minor Changes

- Make `Queryable<T>` uniformly immutable. Chainable operators (`take`, `skip`, `distinct`,
  `where*`, `groupBy`, `having`, `orderBy`/`thenBy`, `union`/`unionAll`, `include`/`thenInclude`,
  `innerJoinOn`/`leftJoinOn`, `ignoreQueryFilters`, `fallbackTo`, `withAbort`, …) no longer mutate
  the receiver — each returns a fresh instance derived through a single `withModel` path. This
  fixes a shared-mutable-state aliasing bug where forking one base query corrupted both branches
  (`const a = base.take(10); const b = base.take(20)` previously made `a` and `b` share the
  last-written limit).

  Migration: capture the returned instance — `q.take(10)` no longer mutates `q`. Code that relied
  on in-place mutation (calling an operator as a statement and then reusing the original) must use
  the returned value instead.

## 2.4.38

### Patch Changes

- Replace the 11-positional-argument `Queryable` constructor with an immutable `QueryContext`
  value object (`@internal`, exposed via `@ts-linq/query/internal`). The constructor is now
  `(entityClass, context, model?)`, and `clone()` / `selectCompiled()` / `ofType()` copy a single
  context reference instead of reproducing the exact positional ordering. A `with()` wither provides
  explicit per-chain overrides (e.g. `ofType` clearing entity query filters) in place of positional
  `undefined` placeholders, and the `SqlVisitorFactory` (from the `where`/`having` wiring work) now
  lives on the context as a shared assembly point.

  Fixes a latent bug: `selectCompiled` (the transformer-emitted projection behind `select(...)`)
  silently dropped its global filters, soft-delete options, change-tracker attacher, tracking mode,
  splitting behaviour and entity query filters, so a projected query lost its tracking/filter
  configuration. Projections now carry the full context plus any per-chain
  `asNoTracking()` / `asSplitQuery()` / `ignoreQueryFilters()` override applied before the projection.

## 2.4.37

### Patch Changes

- Move raw SQL identifier assembly out of `Queryable` into the dialect layer (query/task-6).
  - **Cross-dialect correctness (MySQL fix):** `ofType` (TPH/TPT) and join construction no longer
    emit hardcoded ANSI double-quote (`"`) identifiers. Identifier quoting is now the dialect's
    responsibility, so MySQL renders backticks and SQL Server renders brackets correctly.
  - **`whereInSubquery` correctness:** the column is now resolved to its mapped name
    (`@Column({ name })`) and quoted via the dialect before emission, instead of interpolating the
    raw TypeScript property key.
  - **Structured join model (`@ts-linq/types`):** `JoinClause` gains `onColumns`
    (`JoinOnCondition[]` of table-qualified `JoinColumnRef`s); the dialect renders and quotes them.
    The pre-rendered `on` string is now optional and `@deprecated`, retained as a
    backward-compatible fallback.
  - **`@ts-linq/sql-visitor`:** new public `renderJoinOn` helper renders structured join conditions
    with an injected `quoteIdentifier`; `FragmentJoinPlanner` now emits `onColumns` (fixing the same
    hardcoded-`"` portability bug in entity-splitting fragment joins).
  - **Subquery parameter ordering:** `whereExists`/`whereInSubquery` now normalize a spliced
    subquery's placeholders back to positional `?`, so the dialect's single global `?`→`$N`/`@pN`
    renumbering keeps outer and subquery parameters correctly aligned.

- Updated dependencies
  - @ts-linq/types@4.4.0
  - @ts-linq/sql-visitor@4.3.0
  - @ts-linq/ast@3.2.4
  - @ts-linq/core@3.4.2
  - @ts-linq/metadata@4.1.3
  - @ts-linq/metrics-safe@1.2.6

## 2.4.36

### Patch Changes

- Fix silent/over-broad catch blocks in the query execution path (security + correctness).

  **Security fix (headline):** `GlobalFilterApplier` no longer silently drops a named query
  filter that fails to compile. A swallowed tenant-isolation / soft-delete filter could
  under-filter a query and **leak rows it was meant to hide**. Compilation failures now fail
  closed, throwing the new typed `QueryFilterCompilationError` (with the original failure
  preserved as `cause` and the filter name in `details`).

  **Fallback exhaustion is now observable:** when the hedged select race loses the primary AND
  every fallback source fails, the executor throws the new `FallbackExhaustedError` (primary
  error preserved as `cause`, per-source failures in `details.errors`) instead of returning a
  silently-empty result. "All fallbacks failed" is now distinguishable from "no fallback
  configured", and the fallback sources are attempted at most once.

  **Uniform telemetry logging:** all remaining "ignore" telemetry/degradation catches
  (`RowMaterializer` cache-size / materialization notifications, fallback `populateIncludes`,
  the count-race) are routed through the single `logInternalError` seam — they never break
  materialization or execution.

  **Include proxy no longer double-invokes:** a throwing `include()` lambda now surfaces its
  error after a single invocation instead of re-running the user lambda (no duplicated side
  effects).

  New error types added to `@ts-linq/types`: `QueryFilterCompilationError`
  (`QUERY_FILTER_COMPILATION_ERROR`) and `FallbackExhaustedError` (`FALLBACK_EXHAUSTED`).

- Updated dependencies
  - @ts-linq/types@4.3.0
  - @ts-linq/ast@3.2.3
  - @ts-linq/core@3.4.1
  - @ts-linq/metadata@4.1.2
  - @ts-linq/metrics-safe@1.2.5
  - @ts-linq/sql-visitor@4.2.1

## 2.4.35

### Patch Changes

- Wire the full `SqlVisitorOptions` surface into the `.where()/.having()` runtime path (query/task-4).

  Previously every production `SqlVisitor` in the query layer was constructed bare (`new SqlVisitor()`), silently dropping all options. As a result value converters were **ignored in WHERE/HAVING** (a `HasConversion` column compared against a literal produced wrong results with no error), and spatial / HierarchyId / JSON-path / EF.functions predicates **threw** even though the dialects ship those translators.
  - `@ts-linq/sql-visitor`: new optional `DialectVisitorSupport` capability interface (`getVisitorTranslators()`), the `DialectVisitorTranslators` type, and the `hasVisitorSupport` type guard.
  - `@ts-linq/dialect-postgres` / `@ts-linq/dialect-mysql` / `@ts-linq/dialect-mssql`: implement `DialectVisitorSupport`, exposing their spatial / hierarchy / EF / JSON-path translators (MySQL omits hierarchy, which it does not support).
  - `@ts-linq/query`: a new internal `SqlVisitorFactory` assembles the complete `SqlVisitorOptions` from the dialect (translators) plus entity metadata (`converterResolver`, JSON/complex access rewriters). `whereCompiled`, `havingCompiled` and `GlobalFilterApplier` all obtain their visitor from this single factory.

  **Behavioural change:** value converters are now honoured in `.where()/.having()` — converted literals are emitted instead of raw model values.

- Updated dependencies
  - @ts-linq/sql-visitor@4.2.0

## 2.4.34

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.4.0

## 2.4.33

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.3.0

## 2.4.32

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.2.0

## 2.4.31

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.1.0

## 2.4.30

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.2.0
  - @ts-linq/core@3.0.10
  - @ts-linq/ast@3.2.2
  - @ts-linq/metadata@4.1.1
  - @ts-linq/metrics-safe@1.2.4
  - @ts-linq/sql-visitor@4.1.2

## 2.4.29

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.0.9

## 2.4.28

### Patch Changes

- Updated dependencies
  - @ts-linq/metadata@4.1.0
  - @ts-linq/core@3.0.8

## 2.4.27

### Patch Changes

- Updated dependencies [416a1a6]
  - @ts-linq/types@4.1.0
  - @ts-linq/core@3.0.7
  - @ts-linq/ast@3.2.1
  - @ts-linq/metadata@4.0.1
  - @ts-linq/metrics-safe@1.2.3
  - @ts-linq/sql-visitor@4.1.1

## 2.4.26

### Patch Changes

- @ts-linq/core@3.0.6

## 2.4.25

### Patch Changes

- Updated dependencies [5aa6196]
  - @ts-linq/core@3.0.5

## 2.4.24

### Patch Changes

- Updated dependencies [[`9b8ab21`](https://github.com/mrabaev48/ts-linq/commit/9b8ab213ed02fd09e4724d780a93f72ad26afaa8)]:
  - @ts-linq/ast@3.2.0
  - @ts-linq/sql-visitor@4.1.0
  - @ts-linq/core@3.0.4

## 2.4.23

### Patch Changes

- Updated dependencies [[`a2f36d3`](https://github.com/mrabaev48/ts-linq/commit/a2f36d3383af169a996f6069d907da58ea6a7783)]:
  - @ts-linq/ast@3.1.0
  - @ts-linq/sql-visitor@4.0.2
  - @ts-linq/core@3.0.3

## 2.4.22

### Patch Changes

- Updated dependencies [[`1a4d5a0`](https://github.com/mrabaev48/ts-linq/commit/1a4d5a0eb02cf28e9e0d542894a3f091fa008ac9)]:
  - @ts-linq/sql-visitor@4.0.1

## 2.4.21

### Patch Changes

- Updated dependencies [[`c305564`](https://github.com/mrabaev48/ts-linq/commit/c305564e8c155a50d9e3414fb8499b9e3a50f092)]:
  - @ts-linq/sql-visitor@4.0.0

## 2.4.20

### Patch Changes

- Updated dependencies [[`648b66c`](https://github.com/mrabaev48/ts-linq/commit/648b66c3d10f9c875c44527b6e532cd68d4c8524)]:
  - @ts-linq/sql-visitor@3.0.0

## 2.4.19

### Patch Changes

- Updated dependencies [[`75a9436`](https://github.com/mrabaev48/ts-linq/commit/75a94365e4112b46e74bfaa6fce6dd3c8e86fbb3)]:
  - @ts-linq/ast@3.0.0
  - @ts-linq/sql-visitor@2.9.0
  - @ts-linq/core@3.0.2

## 2.4.18

### Patch Changes

- Updated dependencies [[`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e)]:
  - @ts-linq/ast@2.5.0
  - @ts-linq/sql-visitor@2.8.0
  - @ts-linq/core@3.0.1

## 2.4.17

### Patch Changes

- [#169](https://github.com/mrabaev48/ts-linq/pull/169) [`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Replace the opaque `Function` entity-target type with real constructor types across the
  metadata API and the contracts that thread an entity class.

  **What changed**
  - **`@ts-linq/types`** — adds `EntityCtorRef` (`abstract new (...args: unknown[]) => unknown`):
    the constructor reference accepted by metadata **read/lookup** APIs. It rejects plain
    (non-constructor) functions but, unlike `EntityCtor` (`=> object`), also accepts projection
    element constructors such as the `new () => string` produced by `Queryable.select(x => x.name)`.
    The read/write metadata ports and the entity-class fields are narrowed off `Function`:
    - `MetadataSource` read methods (`getEntity`, `getValidationRules`, `getOwnedEntities`,
      `getStoredProcedureMapping`) → `EntityCtorRef`; `MetadataSink` write methods → `EntityCtor`.
    - `TrackedEntity.entityClass`, `EntityChangeContext.entityClass`,
      `FallbackRequest.entityClass`/`entity`, `EntityCacheLike` get/set/remove, and
      `EntityAttacher.attach` → `EntityCtorRef`.
  - **`@ts-linq/metadata`** — `MetadataRegistry`/`MetadataStorage` and the facet stores are keyed on
    `EntityCtor` (writes) / `EntityCtorRef` (reads). `Function` is eliminated from the package source
    (enforced by newly-enabled `@typescript-eslint/no-unsafe-function-type` and
    `no-unnecessary-type-assertion` rules); the only remaining `as unknown as` is the single audited
    `reflectUtils` capability probe. `EntityMetadataBuilder`'s internal state collapses to a single
    `Partial<EntityMetadata>`.
  - **`@ts-linq/core`** — `DatabaseProvider` CUD method parameters and the mapping decorators
    (`@Entity`, `@Column`, `@PrimaryKey`, relationships, `@Index`, `@ValidIf`) are narrowed off
    `Function`. Decorating a non-class (or a class with a required-argument constructor) is now a
    compile-time error.
  - **`@ts-linq/orm`**, **provider-mysql/postgres/mssql** — entity-class parameters/fields narrowed to
    match the contracts above.

  **Migration**

  Pass a class constructor reference (entity classes are parameterless) to metadata, provider, and
  decorator APIs. A bare `Function` value — or a plain (non-constructor) function — is no longer
  accepted and becomes a compile-time error. This only affects code that was previously passing
  non-constructor values, which was already incorrect at runtime.

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0
  - @ts-linq/metadata@4.0.0
  - @ts-linq/core@3.0.0
  - @ts-linq/ast@2.4.8
  - @ts-linq/metrics-safe@1.2.2
  - @ts-linq/sql-visitor@2.7.7

## 2.4.16

### Patch Changes

- Updated dependencies [[`ccd7235`](https://github.com/mrabaev48/ts-linq/commit/ccd72359ce15f46cca059afba1a2c39d5ea823f2)]:
  - @ts-linq/metadata@3.1.2
  - @ts-linq/core@2.0.6

## 2.4.15

### Patch Changes

- Updated dependencies [[`32cda43`](https://github.com/mrabaev48/ts-linq/commit/32cda43913c6a701add02b0171c4a399147b3d26)]:
  - @ts-linq/metadata@3.1.1
  - @ts-linq/core@2.0.5

## 2.4.14

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/metadata@3.1.0
  - @ts-linq/ast@2.4.7
  - @ts-linq/core@2.0.4
  - @ts-linq/metrics-safe@1.2.1
  - @ts-linq/sql-visitor@2.7.6

## 2.4.13

### Patch Changes

- Updated dependencies [[`941ad27`](https://github.com/mrabaev48/ts-linq/commit/941ad273c224d8968a7c49c385052c0504284e17)]:
  - @ts-linq/metrics-safe@1.2.0
  - @ts-linq/core@2.0.3

## 2.4.12

### Patch Changes

- Updated dependencies [[`70a5949`](https://github.com/mrabaev48/ts-linq/commit/70a5949c4d9640aab4855506e4c0540cf6344cd6)]:
  - @ts-linq/metrics-safe@1.1.0
  - @ts-linq/core@2.0.2

## 2.4.11

### Patch Changes

- Updated dependencies [[`8e79681`](https://github.com/mrabaev48/ts-linq/commit/8e79681455dca1c1f60a616cb9b8882ca9cafef6)]:
  - @ts-linq/metrics-safe@1.0.1
  - @ts-linq/core@2.0.1

## 2.4.10

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0
  - @ts-linq/core@2.0.0
  - @ts-linq/metadata@3.0.0
  - @ts-linq/ast@2.4.6
  - @ts-linq/sql-visitor@2.7.5

## 2.4.9

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/ast@2.4.5
  - @ts-linq/core@1.5.3
  - @ts-linq/metadata@2.7.3
  - @ts-linq/sql-visitor@2.7.4

## 2.4.8

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f), [`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/ast@2.4.4
  - @ts-linq/types@2.12.0
  - @ts-linq/core@1.5.2
  - @ts-linq/sql-visitor@2.7.3
  - @ts-linq/metadata@2.7.2

## 2.4.7

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/ast@2.4.3
  - @ts-linq/core@1.5.1
  - @ts-linq/metadata@2.7.1
  - @ts-linq/sql-visitor@2.7.2

## 2.4.6

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/metadata@2.7.0
  - @ts-linq/core@1.5.0
  - @ts-linq/ast@2.4.2
  - @ts-linq/sql-visitor@2.7.1

## 2.4.5

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0
  - @ts-linq/sql-visitor@2.7.0
  - @ts-linq/ast@2.4.1
  - @ts-linq/core@1.4.8
  - @ts-linq/metadata@2.6.2

## 2.4.4

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/ast@2.4.0
  - @ts-linq/sql-visitor@2.6.0
  - @ts-linq/core@1.4.7
  - @ts-linq/types@2.9.0
  - @ts-linq/metadata@2.6.1

## 2.4.3

### Patch Changes

- Updated dependencies [[`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580)]:
  - @ts-linq/metadata@2.6.0
  - @ts-linq/core@1.4.6

## 2.4.2

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0
  - @ts-linq/ast@2.3.4
  - @ts-linq/core@1.4.5
  - @ts-linq/metadata@2.5.1
  - @ts-linq/sql-visitor@2.5.1

## 2.4.1

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/metadata@2.5.0
  - @ts-linq/sql-visitor@2.5.0
  - @ts-linq/types@2.7.0
  - @ts-linq/core@1.4.4
  - @ts-linq/ast@2.3.3

## 2.4.0

### Minor Changes

- [#129](https://github.com/mrabaev48/ts-linq/pull/129) [`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-32): implement backing fields and property access mode
  - Add `PropertyAccessMode` enum (`Property` | `Field` | `FieldDuringConstruction`) to `@ts-linq/metadata`
  - Add `PropertyAccessor<T>` interface and `createPropertyAccessor` / `defaultPropertyAccessor` factory to `@ts-linq/metadata`
  - Add `hasField(fieldName)` and `usePropertyAccessMode(mode)` to `PropertyBuilder` — mirrors EF Core's API
  - Add entity-level `usePropertyAccessMode(mode)` to `EntityTypeBuilder` — default for all properties, overridable per-property
  - Extend `ColumnMetadata` with `fieldName?`, `accessMode?`, `accessor?` fields
  - Update `RowMaterializer` to call `accessor.constructionSet` during hydration — bypasses setter invariants when configured
  - Update `ChangeTracker.hasChanged` and `cloneObject` to read property values through `accessor.get` / `accessor.set`
  - Default behavior when only `hasField()` is provided: `FieldDuringConstruction` (hydration bypasses setter, user mutations go through setter)
  - No breaking changes — all existing code defaults to `Property` mode (previous behavior)

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0
  - @ts-linq/metadata@2.4.0
  - @ts-linq/ast@2.3.2
  - @ts-linq/core@1.4.3
  - @ts-linq/sql-visitor@2.4.2

## 2.3.1

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/metadata@2.3.0
  - @ts-linq/ast@2.3.1
  - @ts-linq/core@1.4.2
  - @ts-linq/sql-visitor@2.4.1

## 2.3.0

### Minor Changes

- [#117](https://github.com/mrabaev48/ts-linq/pull/117) [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-11): Add global query filters with EF9 named-filter support

  Adds model-level named query filters (`hasQueryFilter`) on `EntityTypeBuilder<T>` and
  per-query opt-out (`ignoreQueryFilters()`) on `DbSet<T>` / `Queryable<T>`, matching
  EF Core 9 semantics.
  - **`@ts-linq/types`**: New `QueryFilterMetadata` interface.
  - **`@ts-linq/metadata`**: `EntityMetadataBuilder.addQueryFilter()` and `MetadataRegistry.mergeFluentQueryFilter()`.
  - **`@ts-linq/orm`**: `EntityTypeBuilder.hasQueryFilter(pred)` / `hasQueryFilter(name, pred)` (transformer-compiled), `DbSet.ignoreQueryFilters()`, `ModelBuilder` exposes per-context filter map.
  - **`@ts-linq/query`**: `Queryable.ignoreQueryFilters()`, `GlobalFilterApplier` applies per-context filters at query time.
  - **`@ts-linq/transformer`**: Rewrites `hasQueryFilter(lambda)` → `hasQueryFilterCompiled(ast, params)` at compile time (same mechanism as `where()`).

- [#120](https://github.com/mrabaev48/ts-linq/pull/120) [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-16): shadow properties — declare DB columns without entity class fields
  - ShadowPropertyMetadata interface added to @ts-linq/types
  - EntityMetadata extended with optional shadowProperties: Map<string, ShadowPropertyMetadata>
  - ColumnMetadata extended with optional isShadow flag
  - EntityTypeBuilder: property<T>(name: string) overload registers shadow properties
  - MetadataRegistry.addShadowProperty() and EntityMetadataBuilder.addShadowProperty()
  - ChangeTracker: \_shadowValues WeakMap for per-entity shadow value storage
  - ChangeTracker: getShadowValue / setShadowValue / getShadowValues public API
  - ChangeTracker.detectChanges() marks entity Modified when shadow values change
  - PropertyEntry<TValue> class with currentValue getter/setter
  - EntityEntry.property<T>(name) returns PropertyEntry backed by ChangeTracker
  - DbContext.entry<T>(entity) public method returning a fully-initialized EntityEntry
  - DbContext.normalizeChange() merges shadow values into entity record before INSERT/UPDATE
  - EF.property<TValue>(entity, name) compile-time marker for LINQ shadow column access
  - SchemaSnapshot.buildExpectedFromMetadata() includes shadow columns in DDL output

- [#121](https://github.com/mrabaev48/ts-linq/pull/121) [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-22): implement EF.functions and HasDbFunction

  Adds `EF.functions` marker object with `like`, `iLike`, `random`, `dateDiffDay`,
  `dateDiffMonth`, `greatest`, `least`, `stDev`, `variance` — all as compile-time
  markers that throw at runtime outside LINQ expressions.

  Adds a new `EfFunctionNode` AST node, transformer CallVisitor recognition of
  `EF.functions.xxx(...)` patterns, per-dialect `EfFunctionTranslator` implementations
  for PostgreSQL (`postgresEfFunctions`), MySQL (`mysqlEfFunctions`), and MSSQL
  (`mssqlEfFunctions`), and `EfFunctionVisitor` in `@ts-linq/sql-visitor`.

  Adds `ModelBuilder.hasDbFunction()` with `DbFunctionBuilder.hasName()` for
  registering user-defined SQL functions for use in LINQ expressions.

### Patch Changes

- [#123](https://github.com/mrabaev48/ts-linq/pull/123) [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1
  - @ts-linq/metadata@2.2.0
  - @ts-linq/ast@2.3.0
  - @ts-linq/sql-visitor@2.4.0

## 2.2.0

### Minor Changes

- 51516f8: feat(p0-04): add ExecuteUpdate and ExecuteDelete bulk DML (EF Core parity)

  `Queryable<T>` and `DbSet<T>` now expose `executeUpdate()` and `executeDelete()` — single-statement
  bulk DML that bypasses the change tracker, mirroring EF Core 7's `ExecuteUpdateAsync` / `ExecuteDeleteAsync`.
  - `@ts-linq/types`: `SetterSpec`, `BulkUpdateContext`, `BulkDeleteContext` interfaces;
    `buildBulkUpdate?` and `buildBulkDelete?` added to `SqlDialect`
  - `@ts-linq/query`: `ISetPropertyCalls<T>`, `SetPropertyCalls<T>`;
    `Queryable.executeUpdate()` and `Queryable.executeDelete()` terminal methods
  - `@ts-linq/orm`: `DbSet.executeUpdate()` and `DbSet.executeDelete()` delegation methods
  - `@ts-linq/dialect-postgres`: `buildBulkUpdate` / `buildBulkDelete` with `$N` placeholders
  - `@ts-linq/dialect-mssql`: `buildBulkUpdate` / `buildBulkDelete` with `@pN` placeholders
  - `@ts-linq/dialect-mysql`: `buildBulkUpdate` / `buildBulkDelete` with `?` placeholders
  - `@ts-linq/testkits`: `TestDialect.buildBulkUpdate` / `buildBulkDelete` for test assertions

  Supports literal values and column-reference copies. Throws a descriptive error when
  `include()` is chained before bulk DML (eager loading is not supported in this path).
  ChangeTracker staleness is documented — callers should reload affected entities if needed.

- cd77e1f: feat(p0-05): add ValueConverter, ValueComparer and HasConversion fluent API

  Adds bidirectional model↔provider value conversion (EF Core HasConversion parity):
  - `ValueConverter<TModel, TProvider>` and `ValueComparer<T>` concrete classes in `@ts-linq/metadata`
  - Built-in converters: `BoolToZeroOneConverter`, `EnumToStringConverter`, `EnumToNumberConverter`, `DateOnlyToStringConverter`
  - `PropertyBuilder.hasConversion()` fluent overloads (converter instance or function pair + optional comparer)
  - `ModelBuilder.properties<T>().haveConversion()` for global type-level converters
  - `ChangeTracker.detectChanges()` uses `ValueComparer.equals/snapshot` for reference-type properties
  - `RowMaterializer` applies `fromProvider` on read; all dialects and providers apply `toProvider` on write
  - `BinaryVisitor` lifts converter to literals in WHERE predicates
  - Bug fix: `MetadataRegistry.registerEntity` no longer overwrites finalized entities when called without a table name

- 90402db: feat(p0-07): add inheritance mapping — TPH, TPT, TPC
  - New `InheritanceStrategy` enum, `HierarchyMetadata`, `DiscriminatorMetadata` types in `@ts-linq/types`
  - `EntityMetadata` extended with `hierarchy?` (root) and `hierarchyRoot?` (subtype) fields
  - `MetadataRegistry`/`MetadataStorage` gain `setHierarchyMetadata()` and `setHierarchyRoot()` methods
  - New `DiscriminatorBuilder<TKey>` fluent builder with `hasValue()` and `isComplete()` — mirrors EF Core API
  - `EntityTypeBuilder` gains `hasDiscriminator()`, `useTphMappingStrategy()`, `useTptMappingStrategy()`, `useTpcMappingStrategy()`
  - `Queryable.ofType<TSub>(ctor)` filters the query: TPH adds WHERE on discriminator, TPT adds INNER JOIN, TPC changes FROM table
  - `RowMaterializer` performs polymorphic dispatch — reads discriminator value from DB row and instantiates the correct concrete subtype
  - `ModelSnapshotBuilder` emits DDL-correct snapshots: TPH adds discriminator column, TPT registers subtype tables, TPC builds full leaf tables with inherited columns

- b738384: feat(temporal): add SQL Server system-versioned table query operators (P2-36)

  Implements all five EF Core temporal operators for SQL Server system-versioned (temporal) tables:
  - `temporalAsOf(date)` — `FOR SYSTEM_TIME AS OF @p`
  - `temporalAll()` — `FOR SYSTEM_TIME ALL`
  - `temporalBetween(from, to)` — `FOR SYSTEM_TIME BETWEEN @p1 AND @p2`
  - `temporalFromTo(from, to)` — `FOR SYSTEM_TIME FROM @p1 TO @p2`
  - `temporalContainedIn(from, to)` — `FOR SYSTEM_TIME CONTAINED IN (@p1, @p2)`

  All five operators are available on both `Queryable<T>` and `DbSet<T>` and are chainable with any other LINQ operator.

  **`@ts-linq/types`**: added `TemporalMode`, `TemporalClause`, `TemporalNotSupportedError`; extended `QueryOptions` with `temporal?` and `EntityMetadata` with `isTemporal?`/`historyTableName?`.

  **`@ts-linq/query`**: `Queryable<T>` temporal methods; `QueryModel.temporal` field; `QueryBuilder.generateFromModel` now correctly passes `from` and `temporal` to `QueryOptions`.

  **`@ts-linq/orm`**: `DbSet<T>` temporal delegates; `EntityTypeBuilder.isTemporal()` and `withHistoryTable(name)` fluent config.

  **`@ts-linq/metadata`**: `EntityMetadataBuilder.setTemporal/setHistoryTableName`; `MetadataRegistry.mergeFluentTemporal`.

  **`@ts-linq/dialect-mssql`**: new `emit-temporal.ts` with `buildTemporalClause`; integrated into `MssqlDialect.buildSelect`.

  **`@ts-linq/dialect-postgres` / `@ts-linq/dialect-mysql`**: throw `TemporalNotSupportedError` when `options.temporal` is set (mirrors EF Core restriction).

- 84a1e2d: Add `tagWith()` / `tagWithCallSite()` query tagging API (mirrors EF Core 8 `TagWith` / `TagWithCallSite`).

  Tags are emitted as leading `-- comment` SQL lines before the statement, making queries identifiable
  in DBA tools, query stores, and slow-query logs without ambiguity.

  Key changes:
  - `Queryable.tagWith(tag)`: attach a diagnostic string comment to the emitted SQL. Multiple calls accumulate in order.
  - `Queryable.tagWithCallSite()`: auto-capture caller's source file and line via `Error().stack` and append as a tag.
  - `Queryable.getTags()`: inspect the current tag list without executing.
  - `DbSet.tagWith()` / `DbSet.tagWithCallSite()` / `DbSet.getTags()`: delegation methods on `DbSet<T>`.
  - `QueryTagError`: thrown at call time when a tag contains newlines or comment-break sequences (`*/`).
  - `QueryTagList` type and `sanitizeTag()` exported from `@ts-linq/query`.
  - `emitTagComments(tags)` exported from `@ts-linq/sql-visitor`: converts a tag list to a SQL comment block.
  - `parseTagsFromSql(sql)` exported from `@ts-linq/telemetry`: extracts leading `-- ` comment lines from SQL.
  - `TelemetryProvider.queryStart()` now adds `db.query.tags` as a structured OTEL span attribute when tags are present.
  - Tags are NOT part of the SQL cache key — the clean SQL is cached, tags are prepended at execution time.

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [84a1e2d]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0
  - @ts-linq/metadata@2.1.0
  - @ts-linq/sql-visitor@2.3.0
  - @ts-linq/core@1.4.0
  - @ts-linq/ast@2.2.1

## 2.1.1

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/ast@2.2.0
  - @ts-linq/core@1.3.0
  - @ts-linq/sql-visitor@2.2.0
  - @ts-linq/types@2.2.0
  - @ts-linq/metadata@2.0.2

## 2.1.0

### Minor Changes

- [#95](https://github.com/mrabaev48/ts-linq/pull/95) [`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-27): add asAsyncEnumerable / forEachAsync / toDictionaryAsync streaming operators

  Enables memory-bounded processing of large result sets via chunked OFFSET pagination (1000 rows per chunk by default). Mirrors EF Core's streaming API.

  **New public APIs on `Queryable<T>` and `DbSet<T>`:**
  - `asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T>` — streams entities via `for await`, respects `.take()` and `.skip()` on the chain
  - `forEachAsync(action, signal?): Promise<void>` — async forEach over streamed entities
  - `toDictionaryAsync<K>(keySelector, signal?): Promise<Map<K, T>>` — keyed map, throws on duplicate keys
  - `toDictionaryAsync<K, V>(keySelector, elementSelector, signal?): Promise<Map<K, V>>` — projected keyed map

  **New `DatabaseProvider` streaming primitives:**
  - `streamRows(baseSql, params, startOffset, maxRows?, signal?): AsyncIterable<Row>` — chunked pagination primitive
  - `buildChunkSql(baseSql, chunkLimit, offset): string` — protected, overridable per dialect

  **Provider changes:**
  - `MssqlProvider.buildChunkSql`: uses `OFFSET n ROWS FETCH NEXT m ROWS ONLY` with automatic `ORDER BY (SELECT NULL)` injection when ORDER BY is absent

  **AbortSignal support:** cancellation is checked between chunks (granularity: 1000 rows by default).

  **EF Core error parity:** `toDictionaryAsync` throws `"An item with the same key has already been added. Key: <key>"` on duplicate keys.

  **Limitations (documented):**
  - `include()`/`thenInclude()` are not populated during streaming; use `toListAsync()` when eager loading is required.
  - `NoTrackingWithIdentityResolution` falls back to no-tracking in streaming path.

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/ast@2.1.0
  - @ts-linq/types@2.1.0
  - @ts-linq/sql-visitor@2.1.0
  - @ts-linq/metadata@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/ast@2.0.0
  - @ts-linq/metadata@2.0.0
  - @ts-linq/sql-visitor@2.0.0
