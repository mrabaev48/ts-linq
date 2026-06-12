# @ts-linq/orm

## 4.1.1

### Patch Changes

- Updated dependencies
  - @ts-linq/query@3.1.1

## 4.1.0

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
  - @ts-linq/query@3.1.0
  - @ts-linq/concurrency@3.0.5
  - @ts-linq/core@3.4.3
  - @ts-linq/metadata@4.1.4
  - @ts-linq/metrics-safe@1.2.7
  - @ts-linq/migrations@2.6.28
  - @ts-linq/sql-visitor@4.3.1
  - @ts-linq/telemetry@2.1.19

## 4.0.24

### Patch Changes

- Updated dependencies
  - @ts-linq/query@3.0.0

## 4.0.23

### Patch Changes

- Updated dependencies
  - @ts-linq/query@2.5.1

## 4.0.22

### Patch Changes

- Updated dependencies
  - @ts-linq/query@2.5.0

## 4.0.21

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

- Updated dependencies
  - @ts-linq/query@2.4.38

## 4.0.20

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.4.0
  - @ts-linq/sql-visitor@4.3.0
  - @ts-linq/query@2.4.37
  - @ts-linq/concurrency@3.0.4
  - @ts-linq/core@3.4.2
  - @ts-linq/metadata@4.1.3
  - @ts-linq/metrics-safe@1.2.6
  - @ts-linq/migrations@2.6.27
  - @ts-linq/telemetry@2.1.18

## 4.0.19

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.3.0
  - @ts-linq/query@2.4.36
  - @ts-linq/concurrency@3.0.3
  - @ts-linq/core@3.4.1
  - @ts-linq/metadata@4.1.2
  - @ts-linq/metrics-safe@1.2.5
  - @ts-linq/migrations@2.6.26
  - @ts-linq/sql-visitor@4.2.1
  - @ts-linq/telemetry@2.1.17

## 4.0.18

### Patch Changes

- Updated dependencies
  - @ts-linq/sql-visitor@4.2.0
  - @ts-linq/query@2.4.35
  - @ts-linq/migrations@2.6.25

## 4.0.17

### Patch Changes

- Curate the `@ts-linq/core` public barrel.

  The package's public API (`src/index.ts`) is now exported via explicit named exports instead of
  `export *`, so adding a symbol to a sub-module no longer silently widens the public surface. The
  only remaining `export *` re-exports are the fully-public value-object sub-barrels `./spatial` and
  `./hierarchy`. The dead `// export * from './utils/InternalLogger'; // Removed` line is removed and
  the inline "moved to package X" comments are consolidated into a single module doc block.

  The backward-compatible `@ts-linq/types` re-exports (`EntityState` plus the telemetry/tracking
  types `CacheInfo`, `CircuitEventInfo`, `CircuitState`, `ConnectionHealthInfo`,
  `ConnectionHealthStatus`, `FallbackInfo`, `QueryAnalysisInfo`, `QueryEndInfo`, `QueryStartInfo`,
  `RetryInfo`, `TrackedEntity`, `TransactionInfo`) are now marked `@deprecated` — import them from
  `@ts-linq/types` directly. They still compile, so this is non-breaking; they are a target for
  hard removal in a future major.

  No public symbol was removed. `@ts-linq/orm` only changes the import path of `EntityState` /
  `TrackedEntity` from `@ts-linq/core` to the canonical `@ts-linq/types` (internal, no API change).

- Updated dependencies
  - @ts-linq/core@3.4.0
  - @ts-linq/migrations@2.6.25
  - @ts-linq/query@2.4.34

## 4.0.16

### Patch Changes

- core: silent-by-default logging — remove console coupling and the static lazy-loading logger

  `@ts-linq/core` no longer writes to the console by default. All internal logging now routes
  through an injected sink with a silent Null Object default; hosts opt into output explicitly
  at the composition root.
  - `InternalLogger`: the unconditional `console.error` is gone. The unified
    `logInternalError(context, error)` channel is preserved and now dispatches to a single
    configurable global handler that defaults to no-op. Install one with
    `setInternalErrorHandler(handler)` (and `setInternalErrorHandler(undefined)` to restore
    silence). Core ships no console handler — the host owns any console dependency.
  - `LazyLoadingProxy`: the static mutable `_logger` (and `setLogger`/`getLogger`) is removed.
    The logger is now injected as an optional trailing `LazyLoadingLogger` parameter on
    `create`/`createMany`/`preloadRelationships`, defaulting to a silent Null Object.
  - `@ts-linq/orm` (`patch`): `DbContext.include` wires the context's configured `SqlLogger`
    (from `options.logging`) into lazy loading, so lazy-load warnings reach the attached logger
    when one is configured and stay silent otherwise.

  Backward-compatibility note: the default behaviour is now silent. Applications that relied on
  core writing lazy-load warnings / internal errors to the console must attach a logger
  explicitly — configure `options.logging` on the `DbContext` (lazy warnings) and/or install a
  handler via `setInternalErrorHandler` (internal telemetry).

- Updated dependencies
  - @ts-linq/core@3.3.0
  - @ts-linq/migrations@2.6.24
  - @ts-linq/query@2.4.33

## 4.0.15

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.2.0
  - @ts-linq/migrations@2.6.23
  - @ts-linq/query@2.4.32

## 4.0.14

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.1.0
  - @ts-linq/migrations@2.6.22
  - @ts-linq/query@2.4.31

## 4.0.13

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.2.0
  - @ts-linq/core@3.0.10
  - @ts-linq/concurrency@3.0.2
  - @ts-linq/metadata@4.1.1
  - @ts-linq/metrics-safe@1.2.4
  - @ts-linq/migrations@2.6.21
  - @ts-linq/query@2.4.30
  - @ts-linq/sql-visitor@4.1.2
  - @ts-linq/telemetry@2.1.16

## 4.0.12

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.0.9
  - @ts-linq/migrations@2.6.20
  - @ts-linq/query@2.4.29

## 4.0.11

### Patch Changes

- Inject `MetadataSource` into the loading layer (break the hidden `MetadataStorage` singleton coupling).

  `EntityLoader`, `RelationshipLoader`, and the `LazyLoadingProxy.create` / `createMany` /
  `preloadRelationships` entry points now resolve entity metadata from an injected `MetadataSource`
  port (reused from `@ts-linq/types`, implemented by `MetadataRegistry`) instead of reaching into the
  process-wide `MetadataStorage` global. `DbContext` wires `options.registry ?? MetadataStorage.getInstance()`
  into the loaders, so per-context / multi-tenant isolation now extends to relationship loading.

  Backward compatible: the new metadata parameter defaults to the global singleton (via the new
  `@deprecated` `getDefaultMetadataSource()` composition helper), so existing callers compile unchanged.
  A new `EmptyMetadataSource` Null Object is exported from `@ts-linq/metadata` for tests that need a
  guaranteed-empty source.

- Updated dependencies
  - @ts-linq/metadata@4.1.0
  - @ts-linq/core@3.0.8
  - @ts-linq/migrations@2.6.19
  - @ts-linq/query@2.4.28

## 4.0.10

### Patch Changes

- Updated dependencies [416a1a6]
  - @ts-linq/types@4.1.0
  - @ts-linq/core@3.0.7
  - @ts-linq/concurrency@3.0.1
  - @ts-linq/metadata@4.0.1
  - @ts-linq/metrics-safe@1.2.3
  - @ts-linq/migrations@2.6.18
  - @ts-linq/query@2.4.27
  - @ts-linq/sql-visitor@4.1.1
  - @ts-linq/telemetry@2.1.15

## 4.0.9

### Patch Changes

- 6bd1cef: Make `ExecutionStrategy` policy-driven and testable.

  `ExecutionStrategy` now consumes a `RetryPolicy` for both the per-attempt backoff
  delay (`getDelayMs`) and the retry decision (`shouldRetry`); the inline
  `Math.pow(2, attempt - 1) * 1000` formula and the magic `1000` literal are removed.
  The blocking `setTimeout` is replaced by an injectable `Sleeper`
  (`type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>`, default
  `setTimeout`-backed and `AbortSignal`-aware), so retry schedules are now
  deterministically unit-testable without real waits. `executeAsync` gains optional
  `inTransaction` and `signal` parameters (backward compatible — both default).

  **BREAKING (`@ts-linq/concurrency`):** the `ExecutionStrategy` constructor signature
  changed from `(opts: ExecutionStrategyOptions, isTransient)` to
  `(policy: RetryPolicy, isTransient, maxRetryCount: number, sleep?: Sleeper)`.

  Migration: replace `new ExecutionStrategy(opts, isTransient)` with the new adapter
  `ExecutionStrategy.fromOptions(opts, isTransient)`, or pass an explicit `RetryPolicy`
  to the constructor.

  `@ts-linq/orm`'s `DatabaseFacade.createExecutionStrategy()` is updated internally to
  use `ExecutionStrategy.fromOptions`; its public surface is unchanged. As a result, the
  default retry backoff timing on that path is unified onto `ExponentialBackoffRetryPolicy`
  (base 50 ms + jitter, capped at `maxRetryDelay`) instead of the previous base-1000 ms
  no-jitter schedule.

- Updated dependencies [6bd1cef]
  - @ts-linq/concurrency@3.0.0
  - @ts-linq/core@3.0.6
  - @ts-linq/migrations@2.6.17
  - @ts-linq/query@2.4.26

## 4.0.8

### Patch Changes

- Updated dependencies [5aa6196]
  - @ts-linq/core@3.0.5
  - @ts-linq/migrations@2.6.16
  - @ts-linq/query@2.4.25

## 4.0.7

### Patch Changes

- Updated dependencies [[`9b8ab21`](https://github.com/mrabaev48/ts-linq/commit/9b8ab213ed02fd09e4724d780a93f72ad26afaa8)]:
  - @ts-linq/sql-visitor@4.1.0
  - @ts-linq/core@3.0.4
  - @ts-linq/query@2.4.24
  - @ts-linq/migrations@2.6.15

## 4.0.6

### Patch Changes

- Updated dependencies [[`a2f36d3`](https://github.com/mrabaev48/ts-linq/commit/a2f36d3383af169a996f6069d907da58ea6a7783)]:
  - @ts-linq/sql-visitor@4.0.2
  - @ts-linq/core@3.0.3
  - @ts-linq/query@2.4.23
  - @ts-linq/migrations@2.6.14

## 4.0.5

### Patch Changes

- Updated dependencies [[`1a4d5a0`](https://github.com/mrabaev48/ts-linq/commit/1a4d5a0eb02cf28e9e0d542894a3f091fa008ac9)]:
  - @ts-linq/sql-visitor@4.0.1
  - @ts-linq/query@2.4.22
  - @ts-linq/migrations@2.6.13

## 4.0.4

### Patch Changes

- Updated dependencies [[`c305564`](https://github.com/mrabaev48/ts-linq/commit/c305564e8c155a50d9e3414fb8499b9e3a50f092)]:
  - @ts-linq/sql-visitor@4.0.0
  - @ts-linq/query@2.4.21
  - @ts-linq/migrations@2.6.13

## 4.0.3

### Patch Changes

- Updated dependencies [[`648b66c`](https://github.com/mrabaev48/ts-linq/commit/648b66c3d10f9c875c44527b6e532cd68d4c8524)]:
  - @ts-linq/sql-visitor@3.0.0
  - @ts-linq/query@2.4.20
  - @ts-linq/migrations@2.6.13

## 4.0.2

### Patch Changes

- Updated dependencies [[`75a9436`](https://github.com/mrabaev48/ts-linq/commit/75a94365e4112b46e74bfaa6fce6dd3c8e86fbb3)]:
  - @ts-linq/sql-visitor@2.9.0
  - @ts-linq/core@3.0.2
  - @ts-linq/query@2.4.19
  - @ts-linq/migrations@2.6.13

## 4.0.1

### Patch Changes

- Updated dependencies [[`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e)]:
  - @ts-linq/sql-visitor@2.8.0
  - @ts-linq/core@3.0.1
  - @ts-linq/query@2.4.18
  - @ts-linq/migrations@2.6.12

## 4.0.0

### Major Changes

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

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0
  - @ts-linq/metadata@4.0.0
  - @ts-linq/core@3.0.0
  - @ts-linq/query@2.4.17
  - @ts-linq/concurrency@2.0.17
  - @ts-linq/metrics-safe@1.2.2
  - @ts-linq/migrations@2.6.11
  - @ts-linq/sql-visitor@2.7.7
  - @ts-linq/telemetry@2.1.14

## 3.0.6

### Patch Changes

- Updated dependencies [[`ccd7235`](https://github.com/mrabaev48/ts-linq/commit/ccd72359ce15f46cca059afba1a2c39d5ea823f2)]:
  - @ts-linq/metadata@3.1.2
  - @ts-linq/core@2.0.6
  - @ts-linq/migrations@2.6.10
  - @ts-linq/query@2.4.16

## 3.0.5

### Patch Changes

- Updated dependencies [[`32cda43`](https://github.com/mrabaev48/ts-linq/commit/32cda43913c6a701add02b0171c4a399147b3d26)]:
  - @ts-linq/metadata@3.1.1
  - @ts-linq/core@2.0.5
  - @ts-linq/migrations@2.6.9
  - @ts-linq/query@2.4.15

## 3.0.4

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/metadata@3.1.0
  - @ts-linq/concurrency@2.0.16
  - @ts-linq/core@2.0.4
  - @ts-linq/metrics-safe@1.2.1
  - @ts-linq/migrations@2.6.8
  - @ts-linq/query@2.4.14
  - @ts-linq/sql-visitor@2.7.6
  - @ts-linq/telemetry@2.1.13

## 3.0.3

### Patch Changes

- Updated dependencies [[`941ad27`](https://github.com/mrabaev48/ts-linq/commit/941ad273c224d8968a7c49c385052c0504284e17)]:
  - @ts-linq/metrics-safe@1.2.0
  - @ts-linq/core@2.0.3
  - @ts-linq/query@2.4.13
  - @ts-linq/migrations@2.6.7

## 3.0.2

### Patch Changes

- Updated dependencies [[`70a5949`](https://github.com/mrabaev48/ts-linq/commit/70a5949c4d9640aab4855506e4c0540cf6344cd6)]:
  - @ts-linq/metrics-safe@1.1.0
  - @ts-linq/core@2.0.2
  - @ts-linq/query@2.4.12
  - @ts-linq/migrations@2.6.6

## 3.0.1

### Patch Changes

- Updated dependencies [[`8e79681`](https://github.com/mrabaev48/ts-linq/commit/8e79681455dca1c1f60a616cb9b8882ca9cafef6)]:
  - @ts-linq/metrics-safe@1.0.1
  - @ts-linq/core@2.0.1
  - @ts-linq/query@2.4.11
  - @ts-linq/migrations@2.6.5

## 3.0.0

### Major Changes

- [#152](https://github.com/mrabaev48/ts-linq/pull/152) [`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d) Thanks [@mrabaev48](https://github.com/mrabaev48)! - refactor(types): replace `Function` with `EntityCtor`/`EntityRef` in the shared metadata model

  Tightens the weak `Function` / `Function | (() => Function)` entity-target types in the shared
  metadata model so wrong (non-constructor) values no longer compile, and downstream packages can
  drop their `as unknown as` casts.

  `@ts-linq/types` now exports two type-only aliases from `metadata.ts` (via the barrel):
  - `type EntityCtor = abstract new (...args: unknown[]) => object`
  - `type EntityRef = EntityCtor | (() => EntityCtor)`

  These replace `Function` in `EntityMetadata.target`/`hierarchyRoot`,
  `RelationshipMetadata.targetEntity` (now `string | EntityRef | undefined`),
  `RelationshipOptions.targetEntity`, `DiscriminatorEntry.ctor`,
  `HierarchyMetadata.rootEntity`/`subtypes`, `OwnedEntityMetadata.ownedType`, and both
  `SkipNavigationMetadata` constructor fields. A plain function or arrow function is no longer
  assignable to these fields.

  **Breaking.** Narrowing the type of exported metadata-interface fields is a breaking change for
  any external consumer that assigned a non-constructor. In lockstep, `@ts-linq/core`,
  `@ts-linq/metadata` and `@ts-linq/orm` narrowed coordinated public signatures — the relationship
  decorators (`OneToMany`/`ManyToOne`/`OneToOne`/`ManyToMany` now take `() => EntityCtor`),
  `loadCompiledModel`/`CompiledModelClassMap`/`DbContextOptions.compiledModelClassMap` (now
  `Record<string, EntityCtor>`), and the fluent model-builder entity generics (now constrained
  `<T extends object>`). These are source-compatible for all conforming code (entity classes are
  constructors and objects); only previously-invalid usage stops compiling. No runtime behaviour
  changes — the aliases erase at compile time.

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0
  - @ts-linq/core@2.0.0
  - @ts-linq/metadata@3.0.0
  - @ts-linq/concurrency@2.0.15
  - @ts-linq/migrations@2.6.4
  - @ts-linq/query@2.4.10
  - @ts-linq/sql-visitor@2.7.5
  - @ts-linq/telemetry@2.1.12

## 2.11.3

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/concurrency@2.0.14
  - @ts-linq/core@1.5.3
  - @ts-linq/metadata@2.7.3
  - @ts-linq/migrations@2.6.3
  - @ts-linq/query@2.4.9
  - @ts-linq/sql-visitor@2.7.4
  - @ts-linq/telemetry@2.1.11

## 2.11.2

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/types@2.12.0
  - @ts-linq/core@1.5.2
  - @ts-linq/query@2.4.8
  - @ts-linq/sql-visitor@2.7.3
  - @ts-linq/concurrency@2.0.13
  - @ts-linq/metadata@2.7.2
  - @ts-linq/migrations@2.6.2
  - @ts-linq/telemetry@2.1.10

## 2.11.1

### Patch Changes

- [#145](https://github.com/mrabaev48/ts-linq/pull/145) [`6db0e1b`](https://github.com/mrabaev48/ts-linq/commit/6db0e1b0b55cba00da9a8f0098873253f2321ac8) Thanks [@mrabaev48](https://github.com/mrabaev48)! - fix(orm): add missing `import 'reflect-metadata'` in ModelBuilder

  `ModelBuilder.safeGetDesignType()` calls `Reflect.getMetadata()` which is
  type-augmented by `reflect-metadata`. Without an explicit import the
  TypeScript compiler (ts-jest) cannot find the method declaration and emits
  `TS2339: Property 'getMetadata' does not exist on type 'typeof Reflect'`,
  causing `ModelBuilder.test.ts` to fail intermittently depending on module
  load order in the Jest runner.

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/concurrency@2.0.12
  - @ts-linq/core@1.5.1
  - @ts-linq/metadata@2.7.1
  - @ts-linq/migrations@2.6.1
  - @ts-linq/query@2.4.7
  - @ts-linq/sql-visitor@2.7.2
  - @ts-linq/telemetry@2.1.9

## 2.11.0

### Minor Changes

- [#143](https://github.com/mrabaev48/ts-linq/pull/143) [`32280c5`](https://github.com/mrabaev48/ts-linq/commit/32280c57ad0e8efa9b003b1a0d3b8e3e1a28e97f) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-29): implement DbSet.local (LocalView<T>), DbSet.find/findAsync, ChangeTracker.findEntry/entries — adds observable in-memory view of tracked entities, O(1) PK-index lookup with composite PK support, and tracker-first / database-fallback FindAsync semantics mirroring EF Core

## 2.10.0

### Minor Changes

- [#141](https://github.com/mrabaev48/ts-linq/pull/141) [`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-21): implement Sequences and HiLo — ModelBuilder.hasSequence(), PropertyBuilder.useHiLo()/useSequence(), HiLoValueGenerator with per-context block reservation, native CREATE SEQUENCE DDL for PostgreSQL/MSSQL, counter-table emulation for MySQL, full schema diff and migration support

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/metadata@2.7.0
  - @ts-linq/migrations@2.6.0
  - @ts-linq/core@1.5.0
  - @ts-linq/concurrency@2.0.11
  - @ts-linq/query@2.4.6
  - @ts-linq/sql-visitor@2.7.1
  - @ts-linq/telemetry@2.1.8

## 2.9.0

### Minor Changes

- [#139](https://github.com/mrabaev48/ts-linq/pull/139) [`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-17): implement Complex Types — ComplexProperty value-object semantics without identity

  Adds `complexProperty()` API mirroring EF Core 8's `ComplexProperty`. Complex type columns
  are flattened into the owner table (e.g. `shippingAddress_street`), detected via deep-value
  equality in ChangeTracker, and rewritten to flat column names in the SQL visitor.

  New exports: `ComplexTypePropertyMetadata` (types), `ComplexTypeBuilder` (orm),
  `ComplexAccessRewriter` (sql-visitor). `EntityMetadata.complexProperties` field added.

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0
  - @ts-linq/sql-visitor@2.7.0
  - @ts-linq/migrations@2.5.0
  - @ts-linq/concurrency@2.0.10
  - @ts-linq/core@1.4.8
  - @ts-linq/metadata@2.6.2
  - @ts-linq/query@2.4.5
  - @ts-linq/telemetry@2.1.7

## 2.8.0

### Minor Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/sql-visitor@2.6.0
  - @ts-linq/core@1.4.7
  - @ts-linq/migrations@2.4.2
  - @ts-linq/types@2.9.0
  - @ts-linq/query@2.4.4
  - @ts-linq/concurrency@2.0.9
  - @ts-linq/metadata@2.6.1
  - @ts-linq/telemetry@2.1.6

## 2.7.0

### Minor Changes

- [#135](https://github.com/mrabaev48/ts-linq/pull/135) [`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-44): implement compiled models / AOT optimization
  - `@ts-linq/metadata`: adds `CompiledModel` interface and `loadCompiledModel()` hydration service
  - `@ts-linq/orm`: DbContext pre-populates MetadataRegistry from `compiledModel` option, skipping reflective decorator scan
  - `@ts-linq/cli`: new `dbcontext optimize` command generates `.generated.ts` AOT snapshots; `--check` flag for CI drift detection

### Patch Changes

- Updated dependencies [[`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580)]:
  - @ts-linq/metadata@2.6.0
  - @ts-linq/core@1.4.6
  - @ts-linq/migrations@2.4.1
  - @ts-linq/query@2.4.3

## 2.6.1

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/migrations@2.4.0
  - @ts-linq/types@2.8.0
  - @ts-linq/concurrency@2.0.8
  - @ts-linq/core@1.4.5
  - @ts-linq/metadata@2.5.1
  - @ts-linq/query@2.4.2
  - @ts-linq/sql-visitor@2.5.1
  - @ts-linq/telemetry@2.1.5

## 2.6.0

### Minor Changes

- [#131](https://github.com/mrabaev48/ts-linq/pull/131) [`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-33): implement stored procedure mapping for Insert/Update/Delete operations

  Adds `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, and `deleteUsingStoredProcedure()`
  fluent API on `EntityTypeBuilder<T>`. When configured, `SaveChanges` routes entity CUD operations
  to dialect-specific CALL/EXEC statements instead of inline DML. Supports input/output parameters,
  original-value parameters, and rows-affected via result column, OUT parameter, or return value.
  Implemented for PostgreSQL (CALL), MySQL (CALL + follow-up SELECT), and MSSQL (EXEC).

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/metadata@2.5.0
  - @ts-linq/sql-visitor@2.5.0
  - @ts-linq/types@2.7.0
  - @ts-linq/core@1.4.4
  - @ts-linq/migrations@2.3.2
  - @ts-linq/query@2.4.1
  - @ts-linq/concurrency@2.0.7
  - @ts-linq/telemetry@2.1.4

## 2.5.0

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
  - @ts-linq/query@2.4.0
  - @ts-linq/concurrency@2.0.6
  - @ts-linq/core@1.4.3
  - @ts-linq/migrations@2.3.1
  - @ts-linq/sql-visitor@2.4.2
  - @ts-linq/telemetry@2.1.3

## 2.4.0

### Minor Changes

- [#127](https://github.com/mrabaev48/ts-linq/pull/127) [`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-31): implement alternate keys and rich indexes
  - Add `hasAlternateKey(selector)` to EntityTypeBuilder — emits named UNIQUE constraints usable as FK targets
  - Add `includeProperties(selector)` and `isDescending(flags[])` to IndexBuilder — covering indexes and per-column sort order
  - Add lambda-selector overload to `hasIndex(selector)` — mirrors EF Core's API
  - Wire `hasPrincipalKey()` → alternate key FK resolution in SchemaSnapshot
  - Add `AlternateKeyMetadata` type and `alternateKeys` field to `EntityMetadata`
  - Add `UniqueConstraintDef` to DiffTypes; diff + DDL emit alternate keys separately from plain indexes
  - All dialects: `generateAddUniqueConstraintSql` / `generateDropUniqueConstraintSql`
  - PostgreSQL covering indexes via INCLUDE clause
  - MySQL: hasFilter silently dropped with warning (not supported natively)

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/metadata@2.3.0
  - @ts-linq/migrations@2.3.0
  - @ts-linq/concurrency@2.0.5
  - @ts-linq/core@1.4.2
  - @ts-linq/query@2.3.1
  - @ts-linq/sql-visitor@2.4.1
  - @ts-linq/telemetry@2.1.2

## 2.3.0

### Minor Changes

- [#115](https://github.com/mrabaev48/ts-linq/pull/115) [`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

- [#117](https://github.com/mrabaev48/ts-linq/pull/117) [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-11): Add global query filters with EF9 named-filter support

  Adds model-level named query filters (`hasQueryFilter`) on `EntityTypeBuilder<T>` and
  per-query opt-out (`ignoreQueryFilters()`) on `DbSet<T>` / `Queryable<T>`, matching
  EF Core 9 semantics.
  - **`@ts-linq/types`**: New `QueryFilterMetadata` interface.
  - **`@ts-linq/metadata`**: `EntityMetadataBuilder.addQueryFilter()` and `MetadataRegistry.mergeFluentQueryFilter()`.
  - **`@ts-linq/orm`**: `EntityTypeBuilder.hasQueryFilter(pred)` / `hasQueryFilter(name, pred)` (transformer-compiled), `DbSet.ignoreQueryFilters()`, `ModelBuilder` exposes per-context filter map.
  - **`@ts-linq/query`**: `Queryable.ignoreQueryFilters()`, `GlobalFilterApplier` applies per-context filters at query time.
  - **`@ts-linq/transformer`**: Rewrites `hasQueryFilter(lambda)` → `hasQueryFilterCompiled(ast, params)` at compile time (same mechanism as `where()`).

- [#118](https://github.com/mrabaev48/ts-linq/pull/118) [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-13): add HasData model seeding with migration diff support

  Implements EF Core-compatible `hasData(...rows)` on `EntityTypeBuilder<T>`. Seed rows are stored in `EntityMetadata`, included in `ModelSnapshot`, and diffed by primary key between snapshots to emit precise INSERT / UPDATE / DELETE statements in the same migration transaction as DDL. Topological sort ensures FK-safe apply order.

- [#119](https://github.com/mrabaev48/ts-linq/pull/119) [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-14): add HasComputedColumnSql, HasCheckConstraint, HasComment fluent API
  - PropertyBuilder: hasComputedColumnSql(sql, options?) sets isComputed/computedExpression/computedStorage
  - PropertyBuilder: hasComment(comment) stores column-level documentation
  - EntityTypeBuilder: hasCheckConstraint(name, sql) declares CHECK constraints
  - EntityTypeBuilder: hasComment(comment) stores table-level documentation
  - CheckConstraintMetadata interface added to @ts-linq/types
  - ColumnMetadata extended with comment and computedStorage fields
  - EntityMetadata extended with checkConstraints and comment fields
  - SchemaSnapshot applies value converter to defaultValue during ColumnDef construction
  - All three dialects emit CHECK constraints inline in CREATE TABLE
  - PostgresDdlStrategy/MssqlDdlStrategy: generateCommentSql() emits COMMENT ON / sp_addextendedproperty
  - MySQL: column comments emitted inline, table comments in CREATE TABLE options

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

- [#122](https://github.com/mrabaev48/ts-linq/pull/122) [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-25): implement table splitting and entity splitting

  Introduces `TableFragmentMetadata` and `EntityMetadata.tableFragments` allowing one entity to be spread across multiple physical tables (entity splitting) and multiple entities to share a single table (table splitting).

  Public API additions:
  - `EntityTypeBuilder.splitToTable(tableName, configure, schema?)` — maps secondary properties of an entity to a separate table
  - `TableSplitConfigBuilder.property(selector)` — configures which properties go into the fragment table
  - `FragmentJoinPlanner.plan(meta)` — auto-generates INNER JOIN clauses for fragment tables in SELECT queries
  - Two or more entities calling `.toTable()` with the same name merge into a single DDL table (table splitting)

  Migration DDL now emits separate `CREATE TABLE` statements for each fragment. `SaveChanges` issues per-fragment INSERT/UPDATE/DELETE within the same transaction. Queries auto-join fragment tables via `FragmentJoinPlanner`.

- [#123](https://github.com/mrabaev48/ts-linq/pull/123) [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.

- [#124](https://github.com/mrabaev48/ts-linq/pull/124) [`4782244`](https://github.com/mrabaev48/ts-linq/commit/47822446d2441afa1c668ef0a019948010c3a041) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `trackGraph`, `autoDetectChangesEnabled`, `EntityEntry.state`, and `EntityEntry.isKeySet` (P1-28).
  - `ChangeTracker.trackGraph(root, entityClass, callback)` — BFS walk over a detached entity graph; callback receives `EntityEntryGraphNode` with `entry.state` and `entry.isKeySet`, mirroring EF Core's `ChangeTracker.TrackGraph`.
  - `ChangeTracker.autoDetectChangesEnabled` — set to `false` to skip the implicit `detectChanges()` call inside `saveChanges()` for bulk-update scenarios; call `detectChanges()` manually when ready.
  - `EntityEntry.state` getter/setter — read or override the tracking state of an entity entry.
  - `EntityEntry.isKeySet` — returns `true` when the entity's primary-key field holds a non-empty value; useful inside `trackGraph` callbacks to decide `Added` vs `Modified`.

- [#125](https://github.com/mrabaev48/ts-linq/pull/125) [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-30): Add value generators and sentinel (EF8)

  Introduces pluggable client-side value generation and sentinel-based "not-set" detection, mirroring EF Core's `ValueGeneratedOnAdd` / `HasValueGenerator` / `HasSentinel` API.
  - **`@ts-linq/types`**: New `ValueGeneratedPolicy` enum (`Never`, `OnAdd`, `OnUpdate`, `OnAddOrUpdate`), `ValueGenerator<T>` interface, `ValueGeneratorClass<T>` type, `ValueGeneratorContext` interface. Extended `ColumnMetadata` with `valueGeneratedPolicy`, `sentinel`, and `valueGeneratorClass` fields.
  - **`@ts-linq/metadata`**: Re-exports all four new symbols from `@ts-linq/types`.
  - **`@ts-linq/orm`**: Six new `PropertyBuilder<T>` methods — `valueGeneratedOnAdd()`, `valueGeneratedOnUpdate()`, `valueGeneratedOnAddOrUpdate()`, `valueGeneratedNever()`, `hasValueGenerator(cls)`, `hasSentinel(value)`. Three built-in generators — `UlidValueGenerator`, `UuidV7ValueGenerator`, `UtcNowValueGenerator`. `DbContext.prefillDefaults()` extended to invoke client-side generators before INSERT/UPDATE using sentinel-aware comparison. `BatchGrouper.calcParamsPerRow()` updated to correctly exclude DB-side generated columns from INSERT parameter lists.

### Patch Changes

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1
  - @ts-linq/metadata@2.2.0
  - @ts-linq/query@2.3.0
  - @ts-linq/migrations@2.2.0
  - @ts-linq/sql-visitor@2.4.0
  - @ts-linq/concurrency@2.0.4
  - @ts-linq/telemetry@2.1.1

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

- 7745012: feat(p0-06): add OwnedEntityTypes — OwnsOne, OwnsMany, ToJson, table-splitting
  - `StorageStrategy` enum (TableSplit | SeparateTable | Json) in `@ts-linq/types`
  - `OwnedEntityMetadata` interface + `EntityMetadata.ownedEntities` field
  - `MetadataRegistry.addOwnedEntity()` / `getOwnedEntities()` in `@ts-linq/metadata`
  - New `OwnedNavigationBuilder<TOwner, TOwned>` in `@ts-linq/orm` with `property()`, `withOwner()`, `hasForeignKey()`, `hasKey()`, `toTable()`, `toJson()`
  - `EntityTypeBuilder.ownsOne()` / `ownsMany()` on existing builder
  - `ModelSnapshotBuilder` expands owned columns (TableSplit prefixed columns, Json column, SeparateTable extra table)
  - `hydrateTableSplit` / `hydrateJson` / `hydrateOwnedEntities` materialization utilities in `@ts-linq/core`

- 90402db: feat(p0-07): add inheritance mapping — TPH, TPT, TPC
  - New `InheritanceStrategy` enum, `HierarchyMetadata`, `DiscriminatorMetadata` types in `@ts-linq/types`
  - `EntityMetadata` extended with `hierarchy?` (root) and `hierarchyRoot?` (subtype) fields
  - `MetadataRegistry`/`MetadataStorage` gain `setHierarchyMetadata()` and `setHierarchyRoot()` methods
  - New `DiscriminatorBuilder<TKey>` fluent builder with `hasValue()` and `isComplete()` — mirrors EF Core API
  - `EntityTypeBuilder` gains `hasDiscriminator()`, `useTphMappingStrategy()`, `useTptMappingStrategy()`, `useTpcMappingStrategy()`
  - `Queryable.ofType<TSub>(ctor)` filters the query: TPH adds WHERE on discriminator, TPT adds INNER JOIN, TPC changes FROM table
  - `RowMaterializer` performs polymorphic dispatch — reads discriminator value from DB row and instantiates the correct concrete subtype
  - `ModelSnapshotBuilder` emits DDL-correct snapshots: TPH adds discriminator column, TPT registers subtype tables, TPC builds full leaf tables with inherited columns

- 240059c: feat(p0-08): implement many-to-many skip navigations — HasMany().WithMany(), UsingEntity<T>, SkipNavigationMetadata, ChangeTracker collection diffing, migration join table DDL
- e4c55db: Implement P0-09: Cascade Delete Behaviors with all seven EF Core modes
  - Add `deleteBehaviorToSql()` mapping `DeleteBehavior` enum to SQL `ON DELETE` clause strings
  - Populate `foreignKeys` in `SchemaSnapshotBuilder.buildExpectedFromMetadata()` from relationship metadata, including the correct `ON DELETE` clause per dialect
  - Add FK comparison to `SchemaComparator.compareSchemas()` so FK creates/drops appear in migration diffs
  - Add `CascadeWalker` — client-side graph walker that applies `Cascade`, `ClientCascade`, `SetNull`, `ClientSetNull` behaviors on tracked entities before `saveChanges()` commits
  - Integrate `CascadeWalker` into `ChangeTracker.applyCascades()` and invoke it in `DbContext.saveChanges()` after `detectChanges()`
  - Export `CascadeWalker`, `deleteBehaviorToSql`, and `buildCreateTableSql` from their respective package public APIs

- 2f86a0d: feat(p0-10): implement concurrency tokens, RowVersion, and DbUpdateConcurrencyException
  - `PropertyBuilder.isConcurrencyToken()` and `isRowVersion()` fluent API methods
  - `ColumnMetadata.isConcurrencyToken` flag in `@ts-linq/types`
  - `DbUpdateConcurrencyException` with populated `entries: EntityEntry[]`
  - `EntityEntry.reload()` and `getDatabaseValues()` recovery helpers
  - WHERE-clause injection of original token values in UPDATE/DELETE for all three dialects (postgres, mysql, mssql)
  - `originalValues` propagated from ChangeTracker snapshot through the full save pipeline
  - `OptimisticConcurrencyError` re-thrown as `DbUpdateConcurrencyException` in `saveChanges()`

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

- a6ba19c: Add `IDbContextFactory<T>`, `DbContextPool<T>`, `PooledDbContextFactory<T>`, `DbContextFactory<T>`, and public factory functions `addDbContextPool` / `addDbContextFactory`.

  Mirrors EF Core's `IDbContextFactory<T>` / `AddDbContextPool` / `AddDbContextFactory` APIs.

  Key changes:
  - `DbContextPool<T>`: LIFO pool that resets and recycles idle `DbContext` instances (default size: 128).
  - `PooledDbContextFactory<T>`: leases contexts from the pool; `await using` automatically returns them via `Symbol.asyncDispose`.
  - `DbContextFactory<T>`: simple (non-pooled) factory for explicit lifetime control.
  - `addDbContextPool(Ctor, options, { poolSize })`: tree-shakable factory function for pooled contexts.
  - `addDbContextFactory(Ctor, options)`: tree-shakable factory function for non-pooled contexts.
  - `DbContext.reset()`: public method that clears ChangeTracker, L2 caches, and transaction depth.
  - `DbContext[Symbol.asyncDispose]()`: enables `await using` on any context; pooled contexts are recycled, non-pooled are disposed.
  - `DbContext.changeTracker`: promoted from `protected` to `public` (mirrors EF Core's public `ChangeTracker` property).

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

- f177bb9: feat(migrations): add migration bundles, idempotent scripts, and HasPendingModelChanges (P2-42)
  - `@ts-linq/migrations`: new `IdempotentEmitter` that wraps each migration in a per-dialect guard block (PostgreSQL DO $$, MSSQL IF NOT EXISTS, MySQL stored procedure); new `MigrationBundleBuilder` using esbuild to produce self-contained Node.js bundle scripts; new `ModelSnapshotBuilder` / `ModelSnapshotSerializer` for deterministic model-state JSON; new `ModelSnapshotDiff` for structural change detection between two snapshots
  - `@ts-linq/orm`: `DatabaseFacade` gains `hasPendingModelChanges()` (synchronous), `getPendingMigrations()`, and `migrate({ idempotent? })` mirroring EF Core's `HasPendingModelChanges`, `GetPendingMigrationsAsync`, and `MigrateAsync`; `DbContextOptionsBuilder` gains `.migrations({ directory })` fluent method; `DbContextOptions` gains `migrationsDirectory` field
  - `@ts-linq/cli`: new `migration:script` command (`--idempotent`, `--output`); new `migration:bundle` command (`--target`, `--output`)

- 6cad9cf: Add `logTo()` / `enableSensitiveDataLogging()` / `enableDetailedErrors()` / `configureWarnings()` diagnostic API (mirrors EF Core `LogTo` / `EnableSensitiveDataLogging` / `EnableDetailedErrors` / `ConfigureWarnings`).

  Key changes:
  - `DbContextOptionsBuilder.logTo(sink, level?)`: routes all diagnostic events to a user-supplied sink function. Level defaults to `'information'`.
  - `DbContextOptionsBuilder.enableSensitiveDataLogging()`: exposes raw SQL parameter values in messages. **Parameters are masked by default** (`:p0`, `:p1`, …) to prevent PII leakage.
  - `DbContextOptionsBuilder.enableDetailedErrors()`: appends full stack traces to error messages.
  - `DbContextOptionsBuilder.configureWarnings(w => w.throw(eventId).log(eventId).suppress(eventId))`: per-event routing — escalate to `EfWarningError`, force-log, or suppress entirely.
  - `DiagnosticEmitter` (new in `@ts-linq/telemetry`): single-chokepoint `SqlLogger` that applies masking, level filtering, and warning escalation. Automatically attached to the provider by `DbContext` when `logTo()` is configured.
  - `WarningConfigurationBuilder` (new in `@ts-linq/telemetry`): fluent builder for the warning route table.
  - `EfWarningError` (new in `@ts-linq/telemetry`): thrown when an event matches a `.throw(eventId)` route.
  - `CoreEventId` / `RelationalEventId` (new in `@ts-linq/telemetry`): string-constant event ID catalog mirroring EF Core's taxonomy.
  - `maskParams()` (new in `@ts-linq/telemetry`): utility that replaces param values with `:p0`, `:p1`, … positional placeholders.
  - `DatabaseProvider.attachLogger(extra)` (new in `@ts-linq/core`): public method to compose an additional `SqlLogger` alongside any existing one without replacing it.
  - `DbContextOptions.logging` (new in `@ts-linq/core`): optional field carrying the `DiagnosticConfig` produced by the builder.
  - `LogLevel`, `WarningBehavior`, `DiagnosticConfig` types added to `@ts-linq/types`.
  - Coexists with OTEL / custom loggers set at the provider level — both receive every event independently.

- d0668cb: feat(p2-46): add MaxBatchSize support for SaveChanges batching

  `DbContextOptionsBuilder.maxBatchSize(n)` enables multi-row INSERT/UPDATE/DELETE
  batching in `saveChanges()`, reducing N round-trips to ceil(N/batchSize) calls.
  - `@ts-linq/orm`: `DbContextOptionsBuilder.maxBatchSize()`, `BatchExecutor`, `BatchGrouper`
  - `@ts-linq/types`: `BatchInsertResult`, `BatchUpdateResult` interfaces; extended `SqlDialect`
  - `@ts-linq/sql-visitor`: `buildQuestionMarkRows`, `chunkArray`, `calcChunkSize` utilities
  - `@ts-linq/dialect-postgres`: `buildPgBatchInsert/Update/Delete`, `PostgresOptionsBuilder`
  - `@ts-linq/dialect-mssql`: `buildMssqlBatchInsert/Update/Delete`, `MssqlOptionsBuilder`
  - `@ts-linq/dialect-mysql`: `buildMysqlBatchInsert/Update/Delete`, `MysqlOptionsBuilder`

  PostgreSQL uses `INSERT ... RETURNING *` and CTE-based bulk UPDATE with type casts.
  MSSQL uses `INSERT ... OUTPUT INSERTED` and VALUES-JOIN bulk UPDATE.
  MySQL uses multi-row INSERT with `LAST_INSERT_ID()` for sequential PK assignment.
  MySQL UPDATE falls back to per-row statements (no clean multi-row UPDATE syntax).

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [e4c55db]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [84a1e2d]
- Updated dependencies [f177bb9]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/query@2.2.0
  - @ts-linq/types@2.3.0
  - @ts-linq/metadata@2.1.0
  - @ts-linq/sql-visitor@2.3.0
  - @ts-linq/migrations@2.1.0
  - @ts-linq/core@1.4.0
  - @ts-linq/telemetry@2.1.0
  - @ts-linq/concurrency@2.0.3

## 2.1.1

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/core@1.3.0
  - @ts-linq/types@2.2.0
  - @ts-linq/query@2.1.1
  - @ts-linq/concurrency@2.0.2
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

- [#97](https://github.com/mrabaev48/ts-linq/pull/97) [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add spatial / geospatial types support (P2-34)

  Implements a NetTopologySuite-equivalent spatial type system:
  - **`@ts-linq/core`** — `Geometry`, `Point`, `LineString`, `Polygon`, `MultiPoint`, `MultiLineString`, `MultiPolygon`, `GeometryCollection` interfaces with factory functions and type guards
  - **`@ts-linq/ast`** — `SpatialMethod` union type; `MethodNode.method` extended to include spatial method names
  - **`@ts-linq/types`** — `SpatialTranslator` interface for dialect-specific spatial SQL generation
  - **`@ts-linq/sql-visitor`** — `SpatialMethodVisitor`, `isSpatialMethod` helper; `SqlVisitor` accepts `{ spatialTranslator }` option
  - **`@ts-linq/dialect-postgres`** — `postgisSpatialFunctions` (PostGIS `ST_*` functions)
  - **`@ts-linq/dialect-mysql`** — `mysqlSpatialFunctions` (MySQL `ST_*` + `ST_Distance_Sphere`)
  - **`@ts-linq/dialect-mssql`** — `mssqlSpatialFunctions` (method-syntax `.STDistance()` etc.)
  - **`@ts-linq/provider-postgres`** — EWKB encode/decode codec; `Geometry` auto-coercion in `coerceToSqlParameter`
  - **`@ts-linq/provider-mysql`** — ISO WKB encode/decode codec; `Geometry` auto-coercion
  - **`@ts-linq/provider-mssql`** — WKT encode/decode codec; `Geometry` auto-coercion
  - **`@ts-linq/orm`** — `DbContextOptionsBuilder.useSpatial()` method

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/query@2.1.0
  - @ts-linq/types@2.1.0
  - @ts-linq/concurrency@2.0.1
  - @ts-linq/metadata@2.0.1

## 2.0.0

### Minor Changes

- [#93](https://github.com/mrabaev48/ts-linq/pull/93) [`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-23): add transaction savepoints and ExecutionStrategy (EnableRetryOnFailure)

  Introduces first-class savepoint API and retry-on-failure execution strategy mirroring EF Core.

  **New public APIs:**
  - `context.database.beginTransactionAsync()` → `DbContextTransaction` with savepoint methods (`createSavepointAsync`, `rollbackToSavepointAsync`, `releaseSavepointAsync`, `commitAsync`, `rollbackAsync`) and `AsyncDisposable` support for `await using`
  - `context.database.createExecutionStrategy()` → `ExecutionStrategy` with `executeAsync(fn)` for automatic transient-error retry with exponential backoff
  - `DbContextOptionsBuilder.enableRetryOnFailure(options)` to configure retry behaviour
  - `ExecutionStrategy` class exported from `@ts-linq/concurrency`
  - `ExecutionStrategyOptions` interface in `@ts-linq/types`

  **Provider enhancements:**
  - `DatabaseProvider.createSavepoint/rollbackToSavepoint/releaseSavepoint` (ANSI SQL default; MSSQL uses `SAVE TRANSACTION` syntax)
  - `DatabaseProvider.checkTransientError()` public facade over transient error classifier
  - Dialect-specific transient error code lists for PostgreSQL (40P01, 40001…), MySQL (1213, 2013…), and SQL Server (1205, 1222…)

  **Breaking changes:** none — all additions are backward compatible.

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/concurrency@2.0.0
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/query@2.0.0
  - @ts-linq/metadata@2.0.0
