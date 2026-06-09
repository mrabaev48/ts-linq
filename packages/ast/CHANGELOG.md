# @ts-linq/ast

## 3.1.0

### Minor Changes

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

## 3.0.0

### Major Changes

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

## 2.5.0

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

## 2.4.8

### Patch Changes

- Updated dependencies [[`6c1d403`](https://github.com/mrabaev48/ts-linq/commit/6c1d403078729a825c39af05bf4dc6ea8c9df644)]:
  - @ts-linq/types@4.0.0

## 2.4.7

### Patch Changes

- Updated dependencies [[`40a71ed`](https://github.com/mrabaev48/ts-linq/commit/40a71ed3079bdf86492e9f27a226470a3985f39e)]:
  - @ts-linq/types@3.1.0

## 2.4.6

### Patch Changes

- Updated dependencies [[`5995782`](https://github.com/mrabaev48/ts-linq/commit/5995782a9f1c7449d7ad457a8cf1700cd80b9c0d)]:
  - @ts-linq/types@3.0.0

## 2.4.5

### Patch Changes

- Updated dependencies [[`fcc484a`](https://github.com/mrabaev48/ts-linq/commit/fcc484a7e9c13f53c30a9e9beac62baf7c616f85)]:
  - @ts-linq/types@2.12.1

## 2.4.4

### Patch Changes

- [#148](https://github.com/mrabaev48/ts-linq/pull/148) [`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f) Thanks [@mrabaev48](https://github.com/mrabaev48)! - fix(ast): re-root AstSqlGenerationError under OrmError for unified error taxonomy

  `AstSqlGenerationError` now extends `@ts-linq/types`' `OrmError` instead of `Error`, so it shares
  the project-wide error taxonomy (`instanceof OrmError`, `code`, `details`, `cause`). Its
  AST-specific `code` union and `details` payload are unchanged; constructor signature is preserved.

- Updated dependencies [[`288f77d`](https://github.com/mrabaev48/ts-linq/commit/288f77d2a8027e912e60edfe6b9e171d6c9f548f)]:
  - @ts-linq/types@2.12.0

## 2.4.3

### Patch Changes

- Updated dependencies [[`2df83e5`](https://github.com/mrabaev48/ts-linq/commit/2df83e5c5c49a1c4be98748905fdf2d9511b4d56)]:
  - @ts-linq/types@2.11.1

## 2.4.2

### Patch Changes

- Updated dependencies [[`6304976`](https://github.com/mrabaev48/ts-linq/commit/6304976b1ad6aeaf3db8f9fc2182b89f766340c6)]:
  - @ts-linq/types@2.11.0

## 2.4.1

### Patch Changes

- Updated dependencies [[`f03dbf1`](https://github.com/mrabaev48/ts-linq/commit/f03dbf1d4c9ee5f10faf70a3d87babc638918508)]:
  - @ts-linq/types@2.10.0

## 2.4.0

### Minor Changes

- [#137](https://github.com/mrabaev48/ts-linq/pull/137) [`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P0-15): implement JSON columns — OwnsOne/OwnsMany with ToJson(), LINQ querying into JSON paths, per-dialect SQL translation (Postgres JSONB, MySQL JSON, MSSQL JSON_VALUE), JsonShape descriptor, JsonAccessRewriter, JsonSnapshotter for change tracking, and dialect-native DDL emission.

### Patch Changes

- Updated dependencies [[`40a9c1e`](https://github.com/mrabaev48/ts-linq/commit/40a9c1ed468d089e3ec236423612afa4ce17b252)]:
  - @ts-linq/types@2.9.0

## 2.3.4

### Patch Changes

- Updated dependencies [[`9c2ad23`](https://github.com/mrabaev48/ts-linq/commit/9c2ad23d0a2f934f881524e280e76329f4d1eed0)]:
  - @ts-linq/types@2.8.0

## 2.3.3

### Patch Changes

- Updated dependencies [[`1dd26bb`](https://github.com/mrabaev48/ts-linq/commit/1dd26bbb55d4e7ca1e522a5e763c4893ea3dde54)]:
  - @ts-linq/types@2.7.0

## 2.3.2

### Patch Changes

- Updated dependencies [[`1a0d098`](https://github.com/mrabaev48/ts-linq/commit/1a0d098baa3e18f406eafae8281ee7daf442cdea)]:
  - @ts-linq/types@2.6.0

## 2.3.1

### Patch Changes

- Updated dependencies [[`4c6abea`](https://github.com/mrabaev48/ts-linq/commit/4c6abead6c23c96d3faa01c4f12368f92ed935f5)]:
  - @ts-linq/types@2.5.0

## 2.3.0

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

### Patch Changes

- Updated dependencies [[`2f86a0d`](https://github.com/mrabaev48/ts-linq/commit/2f86a0d8b0487673603aa6816997ed394e9d91e7), [`2aa9392`](https://github.com/mrabaev48/ts-linq/commit/2aa939259c682cad252f89818db47909e1af16f8), [`69ecc17`](https://github.com/mrabaev48/ts-linq/commit/69ecc171e11a03f46c02533dc2b13351f5cd16a3), [`5284cc5`](https://github.com/mrabaev48/ts-linq/commit/5284cc519fe8c5c6486b35c6d88a00e114317a7b), [`66043bb`](https://github.com/mrabaev48/ts-linq/commit/66043bb78642b837464d20a8040660af69e61795), [`03caeac`](https://github.com/mrabaev48/ts-linq/commit/03caeac9ea0c29aca70922b0c349aae30dc3d907)]:
  - @ts-linq/types@2.4.0

## 2.2.1

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
  - @ts-linq/types@2.1.0

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/types@2.0.0
