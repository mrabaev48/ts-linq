# @ts-linq/sql-visitor

## 4.3.7

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.11.0
  - @ts-linq/ast@3.2.11

## 4.3.6

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.10.0
  - @ts-linq/ast@3.2.10

## 4.3.5

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.9.0
  - @ts-linq/ast@3.2.9

## 4.3.4

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.8.0
  - @ts-linq/ast@3.2.8

## 4.3.3

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.7.0
  - @ts-linq/ast@3.2.7

## 4.3.2

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.6.0
  - @ts-linq/ast@3.2.6

## 4.3.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.5.0
  - @ts-linq/ast@3.2.5

## 4.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.4.0
  - @ts-linq/ast@3.2.4

## 4.2.1

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.3.0
  - @ts-linq/ast@3.2.3

## 4.2.0

### Minor Changes

- Wire the full `SqlVisitorOptions` surface into the `.where()/.having()` runtime path (query/task-4).

  Previously every production `SqlVisitor` in the query layer was constructed bare (`new SqlVisitor()`), silently dropping all options. As a result value converters were **ignored in WHERE/HAVING** (a `HasConversion` column compared against a literal produced wrong results with no error), and spatial / HierarchyId / JSON-path / EF.functions predicates **threw** even though the dialects ship those translators.
  - `@ts-linq/sql-visitor`: new optional `DialectVisitorSupport` capability interface (`getVisitorTranslators()`), the `DialectVisitorTranslators` type, and the `hasVisitorSupport` type guard.
  - `@ts-linq/dialect-postgres` / `@ts-linq/dialect-mysql` / `@ts-linq/dialect-mssql`: implement `DialectVisitorSupport`, exposing their spatial / hierarchy / EF / JSON-path translators (MySQL omits hierarchy, which it does not support).
  - `@ts-linq/query`: a new internal `SqlVisitorFactory` assembles the complete `SqlVisitorOptions` from the dialect (translators) plus entity metadata (`converterResolver`, JSON/complex access rewriters). `whereCompiled`, `havingCompiled` and `GlobalFilterApplier` all obtain their visitor from this single factory.

  **Behavioural change:** value converters are now honoured in `.where()/.having()` — converted literals are emitted instead of raw model values.

## 4.1.2

### Patch Changes

- Updated dependencies
  - @ts-linq/types@4.2.0
  - @ts-linq/ast@3.2.2

## 4.1.1

### Patch Changes

- Updated dependencies [416a1a6]
  - @ts-linq/types@4.1.0
  - @ts-linq/ast@3.2.1

## 4.1.0

### Minor Changes

- [#184](https://github.com/mrabaev48/ts-linq/pull/184) [`9b8ab21`](https://github.com/mrabaev48/ts-linq/commit/9b8ab213ed02fd09e4724d780a93f72ad26afaa8) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Support JSON-owned nested properties in `isNull` / `isNotNull` / `method` predicate positions.

  `IsNullNode.property`, `IsNotNullNode.property` and `MethodNode.object` are widened to
  `PropertyNode | JsonPathExpression` (additive union). `JsonAccessRewriter` now propagates a
  rewritten JSON path into those positions instead of throwing `UNSUPPORTED_JSON_POSITION`, and
  `NullVisitor` / `MethodVisitor` render the path through the dialect's existing `JsonPathTranslator`
  port (the same delegation `BinaryVisitor` uses) wrapped in `IS NULL` / `IS NOT NULL` / `LIKE`. This
  makes `where(a => a.preferences.theme == null)` and `a.preferences.theme.startsWith('x')`
  expressible over JSON-owned navigations across all three dialects, with no spurious parameters on
  the null-check form. No dialect source changes were required.

### Patch Changes

- Updated dependencies [[`9b8ab21`](https://github.com/mrabaev48/ts-linq/commit/9b8ab213ed02fd09e4724d780a93f72ad26afaa8)]:
  - @ts-linq/ast@3.2.0

## 4.0.2

### Patch Changes

- [#182](https://github.com/mrabaev48/ts-linq/pull/182) [`a2f36d3`](https://github.com/mrabaev48/ts-linq/commit/a2f36d3383af169a996f6069d907da58ea6a7783) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Fail loud on JSON paths in `isNull`/`isNotNull`/`method` positions.

  `JsonAccessRewriter` previously **silently dropped** the JSON rewrite when a JSON-owned nested
  property (e.g. `a.preferences.theme`) resolved into an `IS NULL` / `IS NOT NULL` or
  string-method (`LIKE`) position, emitting wrong SQL against a non-existent multi-segment column.
  No dialect translator supports a JSON path in these positions, so the rewriter now throws a
  typed `AstSqlGenerationError` with the new stable code `UNSUPPORTED_JSON_POSITION` (carrying the
  offending `column`/`path` in `details`) instead of producing incorrect SQL.
  - `@ts-linq/ast` (**minor**): adds the `UNSUPPORTED_JSON_POSITION` member to
    `AstSqlGenerationErrorCode`.
  - `@ts-linq/sql-visitor` (**patch**): correctness fix — replaces the two silent
    pass-through branches with a fail-loud throw and removes the misleading comment.

  Full JSON-path support in these positions (AST widening + dialect translators) is deferred; see
  `sql-visitor/task-6`.

- Updated dependencies [[`a2f36d3`](https://github.com/mrabaev48/ts-linq/commit/a2f36d3383af169a996f6069d907da58ea6a7783)]:
  - @ts-linq/ast@3.1.0

## 4.0.1

### Patch Changes

- [#180](https://github.com/mrabaev48/ts-linq/pull/180) [`1a4d5a0`](https://github.com/mrabaev48/ts-linq/commit/1a4d5a0eb02cf28e9e0d542894a3f091fa008ac9) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Fix `EfFunctionVisitor` binding an entity column name as a literal SQL parameter when a property
  is used in an EF.functions value position.

  Previously, a `PropertyNode` argument to `like` / `iLike` / `dateDiffDay` / `dateDiffMonth`
  (e.g. `EF.functions.dateDiffDay(a.start, a.end)`) emitted a placeholder (`?` / `$N`) and bound
  the **column name string** as the parameter value (with the column resolver dropped), so the
  generated SQL compared against the literal string `"end"` instead of the `end` column. A property
  in a value position is now inlined as a resolved column reference — no placeholder, no bound
  parameter — matching the already-correct variadic path. Literal and parameter-ref arguments are
  unchanged.

  This path is not yet reachable from `.where()` in the live query pipeline, so the fix is a
  pre-emptive correction with no observable change for current consumers.

## 4.0.0

### Major Changes

- [#178](https://github.com/mrabaev48/ts-linq/pull/178) [`c305564`](https://github.com/mrabaev48/ts-linq/commit/c305564e8c155a50d9e3414fb8499b9e3a50f092) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Curate the public barrel of `@ts-linq/sql-visitor` to the intended published contract.

  The package now exports only `SqlVisitor`/`SqlVisitorOptions`, `ParameterState`/`ParameterStyle`,
  the rewriters (`JsonAccessRewriter`, `ComplexAccessRewriter`), the emitters (`CallSyntaxEmitter`,
  `ExecSyntaxEmitter`, `emitTagComments`, and the batch helpers `buildQuestionMarkRows`,
  `calcChunkSize`, `chunkArray`), and the translator / fragment / port _types_.

  **Breaking:** the sub-visitors (`BinaryVisitor`, `EfFunctionVisitor`, `FragmentJoinPlanner`,
  `HierarchyMethodVisitor`, `InVisitor`, `JsonPathVisitor`, `LogicalVisitor`, `MethodVisitor`,
  `NullVisitor`, `SpatialMethodVisitor`, `UnaryVisitor`) and the free helpers (`renderPropertyName`,
  `resolveParameterRef`, `isHierarchyMethod`, `isSpatialMethod`) are no longer exported from
  `@ts-linq/sql-visitor`. They are implementation collaborators of `SqlVisitor` and now live behind
  the new `@ts-linq/sql-visitor/internal` subpath.

  **Migration:** prefer `SqlVisitor` for all SQL generation. If you must reach into a sub-visitor,
  import it from `@ts-linq/sql-visitor/internal` (unstable — may change without notice). Example:

  ```ts
  // before
  import { FragmentJoinPlanner } from '@ts-linq/sql-visitor';
  // after
  import { FragmentJoinPlanner } from '@ts-linq/sql-visitor/internal';
  ```

## 3.0.0

### Major Changes

- [#175](https://github.com/mrabaev48/ts-linq/pull/175) [`648b66c`](https://github.com/mrabaev48/ts-linq/commit/648b66c3d10f9c875c44527b6e532cd68d4c8524) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Unify the node-visitor contract and replace the hand-written dispatch switch with a registry.

  All sub-visitors now implement a single `NodeVisitor<N>` interface and accept one cohesive
  `VisitContext` (`{ inputParameters, resolver, converterResolver, state, recurse }`) instead of
  the previous divergent positional parameter lists. `SqlVisitor` dispatches through an internal
  `Map<ExpressionNode['type'], NodeVisitor>` (mirroring the transformer's `DISPATCH_MAP`); optional
  translators (`efFunction`, `jsonPath`) register their real visitor when configured or a throwing
  stub otherwise. `NullVisitor` is unified into a single `visit` (its `visitIsNull` / `visitIsNotNull`
  methods are removed). SQL output is byte-identical.

  `SqlVisitor`'s public API (`toSql`, the constructor, `SqlVisitorOptions`) is unchanged.

  BREAKING: the exported sub-visitor classes (`BinaryVisitor`, `LogicalVisitor`, `UnaryVisitor`,
  `NullVisitor`, `InVisitor`, `MethodVisitor`, `EfFunctionVisitor`, `JsonPathVisitor`,
  `SpatialMethodVisitor`, `HierarchyMethodVisitor`) now expose `visit(node, ctx: VisitContext)`.
  Code that called these visitors directly with positional arguments must build a `VisitContext`.
  `NullVisitor.visitIsNull` / `visitIsNotNull` are replaced by `visit`. New exported types:
  `NodeVisitor` and `VisitContext`.

## 2.9.0

### Minor Changes

- [#173](https://github.com/mrabaev48/ts-linq/pull/173) [`75a9436`](https://github.com/mrabaev48/ts-linq/commit/75a94365e4112b46e74bfaa6fce6dd3c8e86fbb3) Thanks [@mrabaev48](https://github.com/mrabaev48)! - Relocate the rendered-SQL-fragment DTOs out of the pure-AST package.

  `ConditionFragment` (`{ condition, parameters }`) and `SqlFragment` (`{ fragment, params }`)
  describe _already-rendered_ SQL — a SQL-generation concern, not an AST-node concern. They have
  moved to `@ts-linq/sql-visitor`, which is their only consumer, so `@ts-linq/ast` is now strictly
  a pure node-definition + typed-error layer with zero SQL-generation surface.

  **What changed**
  - **`@ts-linq/ast`** (major) — **removed** `ConditionFragment` and `SqlFragment` from the public
    API (`src/types.ts` deleted; no longer re-exported from the barrel). A backward-compatible
    re-export is intentionally **not** provided: `@ts-linq/ast` may depend only on `@ts-linq/types`,
    so re-exporting from `@ts-linq/sql-visitor` would violate the package boundary and create a
    dependency cycle.
  - **`@ts-linq/sql-visitor`** (minor) — now **owns and exports** `ConditionFragment` and
    `SqlFragment` (new `src/types.ts`). Internal visitors were migrated to the local definitions.
    No runtime or shape change.

  **Migration**

  Import `ConditionFragment` / `SqlFragment` from `@ts-linq/sql-visitor` instead of
  `@ts-linq/ast`. The shapes are unchanged; only the import path moved.

### Patch Changes

- Updated dependencies [[`75a9436`](https://github.com/mrabaev48/ts-linq/commit/75a94365e4112b46e74bfaa6fce6dd3c8e86fbb3)]:
  - @ts-linq/ast@3.0.0

## 2.8.0

### Minor Changes

- [#171](https://github.com/mrabaev48/ts-linq/pull/171) [`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e) Thanks [@mrabaev48](https://github.com/mrabaev48)! - De-duplicate the `jsonPath` AST node: restore a single source of truth.

  **What changed**
  - **`@ts-linq/ast`** — `Nodes.ts` no longer redeclares the `jsonPath` node inline. The
    `ExpressionNode` union now references the canonical `JsonPathExpression` directly, and the
    misleading "re-export … imported inline" comment was removed. `JsonPathNode` is retained as a
    `@deprecated` type alias (`export type JsonPathNode = JsonPathExpression`) so existing imports
    keep compiling. No runtime/shape change.
  - **`@ts-linq/sql-visitor`** — now re-exports the canonical `JsonPathExpression` (additive);
    the internal `JsonAccessRewriter` and `JsonPathVisitor`/`JsonPathTranslator` were migrated to
    it. The `JsonPathNode` re-export is kept as `@deprecated` for backward compatibility.
  - **`@ts-linq/dialect-{postgres,mysql,mssql}`** — JSON-path translators now reference
    `JsonPathExpression` instead of the deprecated `JsonPathNode` alias. Internal type rename only;
    no behavioral change.

  **Migration**

  No action required — `JsonPathNode` still resolves via a deprecated alias. New code should import
  `JsonPathExpression` from `@ts-linq/ast` (or `@ts-linq/sql-visitor`). The `JsonPathNode` alias is
  slated for removal in a future major release.

### Patch Changes

- Updated dependencies [[`7986b75`](https://github.com/mrabaev48/ts-linq/commit/7986b75e27fbb720238c3d160c47fa79de3f340e)]:
  - @ts-linq/ast@2.5.0

## 2.7.7

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0
  - @ts-linq/ast@2.4.8

## 2.7.6

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0
  - @ts-linq/ast@2.4.7

## 2.7.5

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0
  - @ts-linq/ast@2.4.6

## 2.7.4

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1
  - @ts-linq/ast@2.4.5

## 2.7.3

### Patch Changes

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f), [`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/ast@2.4.4
  - @ts-linq/types@2.12.0

## 2.7.2

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1
  - @ts-linq/ast@2.4.3

## 2.7.1

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0
  - @ts-linq/ast@2.4.2

## 2.7.0

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
  - @ts-linq/ast@2.4.1

## 2.6.0

### Minor Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/ast@2.4.0
  - @ts-linq/types@2.9.0

## 2.5.1

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0
  - @ts-linq/ast@2.3.4

## 2.5.0

### Minor Changes

- [#131](https://github.com/mrabaev48/ts-linq/pull/131) [`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-33): implement stored procedure mapping for Insert/Update/Delete operations

  Adds `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, and `deleteUsingStoredProcedure()`
  fluent API on `EntityTypeBuilder<T>`. When configured, `SaveChanges` routes entity CUD operations
  to dialect-specific CALL/EXEC statements instead of inline DML. Supports input/output parameters,
  original-value parameters, and rows-affected via result column, OUT parameter, or return value.
  Implemented for PostgreSQL (CALL), MySQL (CALL + follow-up SELECT), and MSSQL (EXEC).

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/types@2.7.0
  - @ts-linq/ast@2.3.3

## 2.4.2

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0
  - @ts-linq/ast@2.3.2

## 2.4.1

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0
  - @ts-linq/ast@2.3.1

## 2.4.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`568ec79`](https://github.com/mrabaev48/ts-linq/commit/568ec792462bc5f1f9686d7a903bbe01592f71bb), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0
  - @ts-linq/ast@2.3.0

## 2.3.0

### Minor Changes

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
  - @ts-linq/ast@2.2.1

## 2.2.0

### Minor Changes

- [#98](https://github.com/mrabaev48/ts-linq/pull/98) [`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P2-35): add HierarchyId support — SQL Server hierarchyid with PostgreSQL ltree fallback

  Mirrors EF Core 8's `HierarchyId` API:
  - `HierarchyId` class in `@ts-linq/core` with `getLevel`, `getAncestor`, `isDescendantOf`, `getDescendant`, `toString`, `toLtreeString`
  - `HierarchyIdTranslator` interface in `@ts-linq/types`
  - `HierarchyMethod` union type (`isDescendantOf | getLevel | getAncestor`) in `@ts-linq/ast`
  - `HierarchyMethodVisitor` in `@ts-linq/sql-visitor` — dispatches to dialect-specific SQL
  - `mssqlHierarchyFunctions` in `@ts-linq/dialect-mssql` — uses `hierarchyid::Parse(?)`, `.GetLevel()`, `.GetAncestor(?)`
  - `postgresLtreeFunctions` in `@ts-linq/dialect-postgres` — uses `<@`, `nlevel()`, `subpath()`
  - MSSQL codec (`encodeHierarchyId` / `decodeHierarchyId`) in `@ts-linq/provider-mssql`
  - Postgres ltree codec (`encodeLtree` / `decodeLtree`) in `@ts-linq/provider-postgres`
  - Both providers detect `HierarchyId` in `coerceToSqlParameter` before geometry/JSON fallback

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/ast@2.2.0
  - @ts-linq/types@2.2.0

## 2.1.0

### Minor Changes

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

- Updated dependencies [[`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/ast@2.1.0
  - @ts-linq/types@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/types@2.0.0
  - @ts-linq/ast@2.0.0
