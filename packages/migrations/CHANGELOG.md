# @ts-linq/migrations

## 2.8.10

### Patch Changes

- Updated dependencies
  - @ts-linq/types@5.0.0
  - @ts-linq/core@3.5.3
  - @ts-linq/metadata@4.1.11

## 2.8.9

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.11.0
  - @ts-linq/core@3.5.2
  - @ts-linq/metadata@4.1.10

## 2.8.8

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.10.0
  - @ts-linq/core@3.5.1
  - @ts-linq/metadata@4.1.9

## 2.8.7

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.5.0

## 2.8.6

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.4.8

## 2.8.5

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.9.0
  - @ts-linq/core@3.4.7
  - @ts-linq/metadata@4.1.8

## 2.8.4

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.8.0
  - @ts-linq/core@3.4.6
  - @ts-linq/metadata@4.1.7

## 2.8.3

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.7.0
  - @ts-linq/core@3.4.5
  - @ts-linq/metadata@4.1.6

## 2.8.2

### Patch Changes

- Internal cleanup: remove the `builders/MigrationHandlers.ts` re-export grab-bag. Its live
  logic moved to the matching `handlers/*` modules (index → `IndexHandlers`, column-change +
  computed/default predicates → `ColumnHandlers`, FK creates → `ForeignKeyHandlers`) and the
  unique-constraint SQL was consolidated into `UniqueConstraintsSqlBuilder` (routing through the
  audited quoter). Structural-typing casts in the column-change predicates were replaced with
  typed `ColumnDef` access. No public API change — `buildAddUniqueConstraintSql`,
  `buildDropUniqueConstraintSql`, and `buildCreateIndexSql` remain importable and emit identical
  SQL.

## 2.8.1

### Patch Changes

- Centralize dialect schema-inspector selection behind a single `SchemaInspectorFactory`.

  The provider-label → inspector dispatch (`postgresql`/`mysql`/`mssql`) was duplicated across
  `SchemaSnapshot.buildActualFromProvider` and `SchemaInspectionService.buildActualSnapshot` (twice),
  and the copies had drifted on the unknown-provider fallback (one assumed tables existed, the other
  returned empty indexes). All call sites now resolve a `SchemaInspector` through
  `SchemaInspectorFactory.for(label, provider)`. Unknown dialects follow one documented policy: they
  throw a typed `UnsupportedOperationError` instead of a silent divergent fallback. Behaviour for the
  supported dialects is unchanged.

## 2.8.0

### Minor Changes

- Decompose the snapshot builders into strategy-based expanders. `ModelSnapshotBuilder` and
  `SchemaSnapshotBuilder` are now thin coordinators that compose an ordered list of single-concern
  `EntityExpander` strategies (inheritance, owned entities, complex types, shadow properties, table
  fragments, skip-navigation join tables) and a shared `ColumnMapper` that owns the single
  column→snapshot mapping. Both builders gain an additive public `buildFrom(entities[, sequences])`
  overload that accepts an injected model, inverting the previous hard coupling to the global
  `MetadataStorage` / `SequenceRegistry` singletons; the existing no-arg `buildFromMetadata` /
  `buildExpectedFromMetadata` methods are retained as the back-compatible default. Public builder
  signatures and snapshot output are unchanged.

## 2.7.1

### Patch Changes

- Security: close arbitrary-code and arbitrary-SQL injection in generated migration artifacts.

  The bundle generator (`MigrationBundleBuilder`) and the idempotent-script emitter
  (`IdempotentEmitter`) previously built executable `.mjs`/`.sql` output by raw string
  concatenation, interpolating filesystem paths and migration metadata directly. A path or
  identifier containing a quote could break out and inject arbitrary code/SQL into an artifact
  an operator later runs; Windows backslash paths also produced invalid import specifiers.
  - New internal `JsLiteral` encoder: `generateEntrySource` now emits structure and routes every
    path leaf through a JSON-escaped, POSIX-normalized import specifier.
  - The idempotent emitter reuses the dialect `literal()` encoder for `version`/`name` and
    fails fast with a typed `BundleBuildError` when an identifier is malformed
    (`version` not `^\d{14}$`, `name` not `^[A-Za-z0-9_]+$`).
  - The generated bundle runtime constrains `DB_PROVIDER` to an allow-list
    (`postgres`/`mysql`/`mssql`) before the dynamic provider import.

  Public signatures (`MigrationBundleBuilder.build`, `IdempotentEmitter.emit/emitStatements`)
  are unchanged.

## 2.7.0

### Minor Changes

- Decompose `MigrationRunner` into injected, testable collaborators and fix a data-integrity bug.

  **Data-corruption fix:** `getAppliedMigrations()`/the new history store no longer swallow query
  errors. Previously a connection/permission failure was indistinguishable from "table not yet
  created" (both returned `[]`), so a failing database could look like "no migrations applied" and
  cause already-applied migrations to be re-run. The store now probes for the bookkeeping table's
  existence and only returns `[]` when it is genuinely absent; any other query failure propagates.

  **Decomposition:** the runner is now a thin orchestrator over three injectable collaborators —
  `MigrationHistoryStore` (with the provider-backed `DefaultMigrationHistoryStore`), `TransactionScope`
  (centralized begin/commit/rollback), and a `MigrationLogger` port (`NO_OP_LOGGER` default — no more
  `console.*` in the library). Apply/rollback failures now throw the typed `MigrationApplyError`/
  `MigrationRollbackError` with the original error preserved as `cause`; if a rollback itself fails it
  is attached as a suppressed error so the original cause is never masked. The `__migrations` table
  schema is defined once (`MIGRATIONS_TABLE` / `buildEnsureMigrationsTableSql`) and shared with the
  idempotent emitter.

  Backward compatible: `new MigrationRunner(provider)` continues to work; the new collaborators are
  supplied via an optional `MigrationRunnerOptions` argument.

## 2.6.30

### Patch Changes

- Add a typed error model for migrations rooted at `OrmError`.

  `@ts-linq/types` gains six new error classes — `MigrationApplyError`,
  `MigrationRollbackError`, `SnapshotSerializationError`, `SnapshotValidationError`,
  `BundleBuildError`, `ProviderRequiredError` — each extending the canonical `OrmError`
  hierarchy (CLAUDE.md §16) with new stable `OrmErrorCode` literals, structured `details`
  context, and preserved `cause`. `MigrationApplyError`/`MigrationRollbackError` provide
  `static from(version, name, cause)` factories for consistent, user-safe diagnostics.

  `@ts-linq/migrations` replaces the bare `throw new Error(...)` calls in its serializers
  (`SchemaSnapshot`, `model-snapshot`), bundle builder (`build-bundle`), and seed validator
  (`SeedDiff`) with these typed errors, preserving the underlying `cause` where one exists.
  Callers can now branch on `error.code` instead of string-matching messages. The
  `MigrationRunner` apply/rollback sites are intentionally deferred to a follow-up task.

- Updated dependencies
  - @ts-linq/types@4.6.0
  - @ts-linq/core@3.4.4
  - @ts-linq/metadata@4.1.5

## 2.6.29

### Patch Changes

- Security: route all emitted-SQL identifier and literal quoting through a single audited,
  injection-safe quoting authority per dialect.

  Previously `q()` wrapped identifiers in the dialect quote character **without escaping**
  embedded quotes (e.g. a column `a"b` produced `"a"b"`), and several sequence/seed/unique-constraint
  builders interpolated bare identifiers into quote characters directly. A crafted
  scaffolded/introspected name or seed value could break out of its quoting and inject SQL into a
  generated migration. This introduces a `SqlQuoter` Strategy (`PostgresQuoter` / `MySqlQuoter` /
  `MssqlQuoter`) selected via `QuoterFactory`, doubling the dialect quote char (`"`→`""`,
  `` ` ``→` ` ``, `]`→`]]`). `q()`and`formatValue()` keep their signatures and now delegate to
the quoter (`formatValue`folded into the single`literal()` path). Output for ordinary
  identifiers/values is unchanged. A scoped ESLint rule plus a unit test guard prevent reintroducing
  raw identifier interpolation in the builders.

## 2.6.28

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.5.0
  - @ts-linq/core@3.4.3
  - @ts-linq/metadata@4.1.4

## 2.6.27

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.4.0
  - @ts-linq/core@3.4.2
  - @ts-linq/metadata@4.1.3

## 2.6.26

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.3.0
  - @ts-linq/core@3.4.1
  - @ts-linq/metadata@4.1.2

## 2.6.25

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.4.0

## 2.6.24

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.3.0

## 2.6.23

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.2.0

## 2.6.22

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.1.0

## 2.6.21

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.2.0
  - @ts-linq/core@3.0.10
  - @ts-linq/metadata@4.1.1

## 2.6.20

### Patch Changes

- Updated dependencies
  - @ts-linq/core@3.0.9

## 2.6.19

### Patch Changes

- Updated dependencies
  - @ts-linq/metadata@4.1.0
  - @ts-linq/core@3.0.8

## 2.6.18

### Patch Changes

- Updated dependencies [416a1a6]
  - @ts-linq/types@4.1.0
  - @ts-linq/core@3.0.7
  - @ts-linq/metadata@4.0.1

## 2.6.17

### Patch Changes

- @ts-linq/core@3.0.6

## 2.6.16

### Patch Changes

- Updated dependencies [5aa6196]
  - @ts-linq/core@3.0.5

## 2.6.15

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.4

## 2.6.14

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.3

## 2.6.13

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.2

## 2.6.12

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@3.0.1

## 2.6.11

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0
  - @ts-linq/metadata@4.0.0
  - @ts-linq/core@3.0.0

## 2.6.10

### Patch Changes

- Updated dependencies [[`ccd7235`](https://github.com/mrabaev48/ts-linq/commit/ccd72359ce15f46cca059afba1a2c39d5ea823f2)]:
  - @ts-linq/metadata@3.1.2
  - @ts-linq/core@2.0.6

## 2.6.9

### Patch Changes

- Updated dependencies [[`32cda43`](https://github.com/mrabaev48/ts-linq/commit/32cda43913c6a701add02b0171c4a399147b3d26)]:
  - @ts-linq/metadata@3.1.1
  - @ts-linq/core@2.0.5

## 2.6.8

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/metadata@3.1.0
  - @ts-linq/core@2.0.4

## 2.6.7

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.3

## 2.6.6

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.2

## 2.6.5

### Patch Changes

- Updated dependencies []:
  - @ts-linq/core@2.0.1

## 2.6.4

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0
  - @ts-linq/core@2.0.0
  - @ts-linq/metadata@3.0.0

## 2.6.3

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/core@1.5.3
  - @ts-linq/metadata@2.7.3

## 2.6.2

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/types@2.12.0
  - @ts-linq/core@1.5.2
  - @ts-linq/metadata@2.7.2

## 2.6.1

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/core@1.5.1
  - @ts-linq/metadata@2.7.1

## 2.6.0

### Minor Changes

- [#141](https://github.com/mrabaev48/ts-linq/pull/141) [`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-21): implement Sequences and HiLo — ModelBuilder.hasSequence(), PropertyBuilder.useHiLo()/useSequence(), HiLoValueGenerator with per-context block reservation, native CREATE SEQUENCE DDL for PostgreSQL/MSSQL, counter-table emulation for MySQL, full schema diff and migration support

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/metadata@2.7.0
  - @ts-linq/core@1.5.0

## 2.5.0

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
  - @ts-linq/core@1.4.8
  - @ts-linq/metadata@2.6.2

## 2.4.2

### Patch Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/core@1.4.7
  - @ts-linq/types@2.9.0
  - @ts-linq/metadata@2.6.1

## 2.4.1

### Patch Changes

- Updated dependencies [[`a3c75aa`](https://github.com/mrabaev48/ts-linq/commit/a3c75aab0b5c3304f0e4bf3c6471f74ee9e4f580)]:
  - @ts-linq/metadata@2.6.0
  - @ts-linq/core@1.4.6

## 2.4.0

### Minor Changes

- [#133](https://github.com/mrabaev48/ts-linq/pull/133) [`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-43): implement database-first scaffolding (reverse engineer)

  Add `scaffoldDbContext()` to `@ts-linq/migrations` that reverse-engineers an existing database into TypeScript entity classes and a `DbContext`. Includes per-dialect introspectors (`PostgresDbIntrospector`, `MySqlDbIntrospector`, `MssqlDbIntrospector`) exported from dialect packages, a name normalizer with `--use-database-names` / `--no-pluralize` options, entity and DbContext code generators, and a new `scaffold` CLI command.

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0
  - @ts-linq/core@1.4.5
  - @ts-linq/metadata@2.5.1

## 2.3.2

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/metadata@2.5.0
  - @ts-linq/types@2.7.0
  - @ts-linq/core@1.4.4

## 2.3.1

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0
  - @ts-linq/metadata@2.4.0
  - @ts-linq/core@1.4.3

## 2.3.0

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
  - @ts-linq/core@1.4.2

## 2.2.0

### Minor Changes

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

- [#122](https://github.com/mrabaev48/ts-linq/pull/122) [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-25): implement table splitting and entity splitting

  Introduces `TableFragmentMetadata` and `EntityMetadata.tableFragments` allowing one entity to be spread across multiple physical tables (entity splitting) and multiple entities to share a single table (table splitting).

  Public API additions:
  - `EntityTypeBuilder.splitToTable(tableName, configure, schema?)` — maps secondary properties of an entity to a separate table
  - `TableSplitConfigBuilder.property(selector)` — configures which properties go into the fragment table
  - `FragmentJoinPlanner.plan(meta)` — auto-generates INNER JOIN clauses for fragment tables in SELECT queries
  - Two or more entities calling `.toTable()` with the same name merge into a single DDL table (table splitting)

  Migration DDL now emits separate `CREATE TABLE` statements for each fragment. `SaveChanges` issues per-fragment INSERT/UPDATE/DELETE within the same transaction. Queries auto-join fragment tables via `FragmentJoinPlanner`.

- [#123](https://github.com/mrabaev48/ts-linq/pull/123) [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Add `toView()`, `hasNoKey()`, and `hasViewSql()` for mapping entities to database views as keyless (read-only) types. Keyless entities are never tracked, throw `KeylessMutationError` on mutations, and query via `FROM viewName` in all dialects.

### Patch Changes

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

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`cda8a4e`](https://github.com/mrabaev48/ts-linq/commit/cda8a4edac105bffd343fe8637f0340c361486e2), [`5f07aeb`](https://github.com/mrabaev48/ts-linq/commit/5f07aebaac481349bfd4ce43079ac34aee351fe4), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/core@1.4.1
  - @ts-linq/metadata@2.2.0

## 2.1.0

### Minor Changes

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

- f177bb9: feat(migrations): add migration bundles, idempotent scripts, and HasPendingModelChanges (P2-42)
  - `@ts-linq/migrations`: new `IdempotentEmitter` that wraps each migration in a per-dialect guard block (PostgreSQL DO $$, MSSQL IF NOT EXISTS, MySQL stored procedure); new `MigrationBundleBuilder` using esbuild to produce self-contained Node.js bundle scripts; new `ModelSnapshotBuilder` / `ModelSnapshotSerializer` for deterministic model-state JSON; new `ModelSnapshotDiff` for structural change detection between two snapshots
  - `@ts-linq/orm`: `DatabaseFacade` gains `hasPendingModelChanges()` (synchronous), `getPendingMigrations()`, and `migrate({ idempotent? })` mirroring EF Core's `HasPendingModelChanges`, `GetPendingMigrationsAsync`, and `MigrateAsync`; `DbContextOptionsBuilder` gains `.migrations({ directory })` fluent method; `DbContextOptions` gains `migrationsDirectory` field
  - `@ts-linq/cli`: new `migration:script` command (`--idempotent`, `--output`); new `migration:bundle` command (`--target`, `--output`)

### Patch Changes

- Updated dependencies [51516f8]
- Updated dependencies [cd77e1f]
- Updated dependencies [7745012]
- Updated dependencies [90402db]
- Updated dependencies [240059c]
- Updated dependencies [2f86a0d]
- Updated dependencies [b738384]
- Updated dependencies [6cad9cf]
- Updated dependencies [d0668cb]
  - @ts-linq/types@2.3.0
  - @ts-linq/metadata@2.1.0
  - @ts-linq/core@1.4.0

## 2.0.2

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/core@1.3.0
  - @ts-linq/types@2.2.0
  - @ts-linq/metadata@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/types@2.1.0
  - @ts-linq/metadata@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/metadata@2.0.0
