# P2-35 — HierarchyId Support

**Status:** done (PR #98, branch feat/p2-35-hierarchy-id)

## Architecture

### HierarchyId class (`@ts-linq/core`)
- `packages/core/src/hierarchy/hierarchy-id.ts` — value type, private constructor
- Internal: `readonly nodes: readonly number[]` (e.g. `/1/2/3/` → `[1, 2, 3]`)
- Static factory: `HierarchyId.parse('/1/2/')`, `HierarchyId.getRoot()`, `HierarchyId.isHierarchyId(v)`
- Instance methods: `getLevel()`, `getAncestor(n)`, `isDescendantOf(other)`, `getDescendant(c1?, c2?)`
- String representations: `toString()` → `/1/2/3/`, `toLtreeString()` → `1.2.3`, `toMssqlString()` → alias for toString()
- Re-exported from `packages/core/src/index.ts` via `export * from './hierarchy'`

### HierarchyIdTranslator (`@ts-linq/types`)
- Interface in `packages/types/src/index.ts`:
  ```ts
  interface HierarchyIdTranslator {
    isDescendantOf(col: string, param: string): string;
    getLevel(col: string): string;
    getAncestor(col: string, param: string): string;
  }
  ```
- Placed in `@ts-linq/types` (NOT in sql-visitor) — same reason as SpatialTranslator: dialect packages depend on types but not sql-visitor

### HierarchyMethod in AST (`@ts-linq/ast`)
- `packages/ast/src/ast/Nodes.ts`: `HierarchyMethod = 'isDescendantOf' | 'getLevel' | 'getAncestor'`
- `MethodNode.method: StringMethod | SpatialMethod | HierarchyMethod`

### HierarchyMethodVisitor (`@ts-linq/sql-visitor`)
- `packages/sql-visitor/src/visitors/HierarchyMethodVisitor.ts`
- `isHierarchyMethod(method: string): boolean` — guards a `Set`
- `HierarchyMethodVisitor.visit()` dispatches:
  - `getLevel` — unary (no args)
  - `isDescendantOf`, `getAncestor` — binary (one arg)
- `SqlVisitor` now accepts `options.hierarchyTranslator?: HierarchyIdTranslator`
- `MethodVisitor` constructor: `(spatialVisitor?, hierarchyVisitor?)`

### Dialect functions
- `packages/dialect-mssql/src/hierarchy-functions.ts` → `mssqlHierarchyFunctions`:
  - `isDescendantOf: (col, p) => col.IsDescendantOf(hierarchyid::Parse(p)) = 1`
  - `getLevel: (col) => col.GetLevel()`
  - `getAncestor: (col, p) => col.GetAncestor(p)`
- `packages/dialect-postgres/src/ltree-functions.ts` → `postgresLtreeFunctions`:
  - `isDescendantOf: (col, p) => col <@ p::ltree`
  - `getLevel: (col) => nlevel(col)`
  - `getAncestor: (col, p) => subpath(col, 0, nlevel(col) - p)`

### Provider codecs
- `packages/provider-mssql/src/hierarchy-codec.ts`:
  - `isHierarchyId`, `encodeHierarchyId` → string like `/1/2/`
  - `decodeHierarchyId(string | Buffer)` — mssql driver returns hierarchyid as string
- `packages/provider-postgres/src/ltree-codec.ts`:
  - `isHierarchyId`, `encodeLtree` → string like `1.2`
  - `decodeLtree(string)` — pg returns ltree as `1.2.3`
- Both providers detect `isHierarchyId(value)` in `coerceToSqlParameter` before geometry/JSON fallback

## Known limitations / follow-up
- Root node `/` encodes to `''` (empty ltree), which is invalid in Postgres; document in schema
- `GetReparentedValue()` (MSSQL-only) has no ltree equivalent — documented in `apps/docs/hierarchy-id.md`
- WHERE lambda syntax (`n => n.path.isDescendantOf(...)`) requires `@ts-linq/transformer` extension — same gap as spatial

## Tests
- Unit: `core/src/hierarchy/__tests__/hierarchy-id.test.ts`, `sql-visitor/tests/HierarchyVisitor.test.ts`, `provider-mssql/tests-new/hierarchy-codec.test.ts`, `provider-postgres/tests-new/ltree-codec.test.ts`
- Integration (gated by env vars): `integration-tests/tests-new/mssql/mssql.hierarchy.integration.test.ts`, `integration-tests/tests-new/postgres/postgres.hierarchy.integration.test.ts`
- E2E (gated by SKIP_DB_TESTS): `e2e-tests/tests/queries/hierarchy.e2e.test.ts`
