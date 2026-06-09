# refactor sql-visitor/task-4 — curate public barrel + `/internal` subpath

**Status:** ✅ Completed (branch `audit-refactor/sql-visitor-barrel-curation`).
**Changeset:** `@ts-linq/sql-visitor` **major** (`.changeset/sql-visitor-internal-barrel.md`).

## What changed
Curated `packages/sql-visitor/src/index.ts` down to the intended Published Language and moved
implementation collaborators behind a new `@ts-linq/sql-visitor/internal` subpath.

### Kept PUBLIC (`src/index.ts`)
- `SqlVisitor`, `SqlVisitorOptions`
- `ParameterState`, `ParameterStyle`
- Rewriters: `JsonAccessRewriter`, **`ComplexAccessRewriter`** (newly added to the barrel — was
  only exported from `SqlVisitor.ts` before; symmetric with `JsonAccessRewriter`, both are
  `SqlVisitor` ctor options)
- Emitters: `CallSyntaxEmitter`, `ExecSyntaxEmitter`, `emitTagComments`
- Batch helpers: `buildQuestionMarkRows`, `calcChunkSize`, `chunkArray` (KEPT public — used
  externally by orm + 3 dialects in `batch-syntax.ts`/`batch-grouper.ts`)
- Types: `EfFunctionTranslator`, `JsonPathTranslator`, `ColumnResolver`, `ConverterResolver`,
  `NodeVisitor`, `VisitContext`, `ConditionFragment`, `SqlFragment`, `JsonPathExpression`,
  `JsonPathNode` (deprecated)

### Moved to `/internal` (`src/internal.ts`, `@internal`-tagged)
All 11 sub-visitors (`BinaryVisitor`, `EfFunctionVisitor`, `FragmentJoinPlanner`,
`HierarchyMethodVisitor`, `InVisitor`, `JsonPathVisitor`, `LogicalVisitor`, `MethodVisitor`,
`NullVisitor`, `SpatialMethodVisitor`, `UnaryVisitor`) + free helpers (`renderPropertyName`,
`resolveParameterRef`, `isHierarchyMethod`, `isSpatialMethod`). Note `JsonPathVisitor` the *class*
is internal but the `JsonPathTranslator` *type* stays public.

## Grep investigation (determined `major`)
Only ONE external non-test consumer of a moved symbol: `packages/query/src/Queryable.ts` imported
`FragmentJoinPlanner` → migrated to `@ts-linq/sql-visitor/internal`. All `sql-visitor/tests/*`
import sub-visitors via relative `../src/...` paths (no barrel) → no test migration needed.
Because a sub-visitor was used externally and migrated to `/internal` → **major** per CLAUDE.md §14.

## Subpath resolution wiring (moduleResolution is classic `node` → `exports` NOT honored)
Adding the `./internal` subpath required mirroring the existing `@ts-linq/query/internal` pattern
in FIVE places (each consumer's resolver needs an explicit mapping):
1. `packages/sql-visitor/package.json` `exports` → `./internal` → `./dist/internal.{d.ts,js}` + esm.
2. `packages/sql-visitor/package.json` **`tsd` block** `compilerOptions.paths` → `dist/internal.d.ts`
   (tsd resolves under node; mirrors metrics-safe `./memory`).
3. `tsconfig.json` (root, used by madge/ts-prune) `paths` → `packages/sql-visitor/dist/internal`.
4. `packages/query/tsconfig.json` `paths` → `../sql-visitor/dist/internal`.
5. `packages/e2e-tests/tsconfig.json` `paths` → `../sql-visitor/src/internal` (e2e ts-jest compiles
   query SRC, so needs src mapping).
6. `packages/jest-config/index.js` — THREE entries (root jest runs against src):
   `tsLinqTsJestConfig.tsconfig.paths`, `tsLinqModuleNameMapper`, AND
   `createPackageJestConfig.moduleNameMapper` — each `^@ts-linq/sql-visitor/internal$` placed
   BEFORE the generic `^@ts-linq/(.*)$` / bare `sql-visitor` entry (order-sensitive).

integration-tests did NOT need a mapping (it consumes query from built `dist`, so query's
`Queryable.d.ts` import of `/internal` is skipLibCheck'd; resolves at runtime via the package
`exports` map after build).

## Tests
Extended `packages/sql-visitor/tests/index.test.ts` with a **public-barrel export snapshot**:
asserts the exact set of runtime value-exports, no `*Visitor` leaks (except `SqlVisitor`), and that
sub-visitors stay reachable via `../src/internal`.
Updated `packages/sql-visitor/test-d/index.test-d.ts` (the task-2 tsd guard) to import
`BinaryVisitor` from `@ts-linq/sql-visitor/internal` instead of the root barrel.

## Validation — all green
typecheck, lint, test:unit (3044), test:integration (464), test:e2e (290), build,
arch:deps, arch:cycles, arch:dead (ts-prune shows no sql-visitor barrel leak), sql-visitor test-d.

## Coordination note
With visitors now behind `/internal`, the task-1 (dispatch registry) and task-2 (required
`ParameterState`) visitor-signature changes are **no longer public breaking changes** — they
would now ship as `patch` rather than `major`.

## Follow-up tech debt
`/internal` is transitional. Ideally `query` should depend on `SqlVisitor` directly, not on
`FragmentJoinPlanner` — fold `FragmentJoinPlanner` usage into the `SqlVisitor` surface during the
`query` package refactor (query/task-1 god-class decomposition). Remaining sql-visitor tasks:
task-3 (EF function property-as-value bug), task-5 (JSON rewrite gap) — package stays
`🔄 In Progress`.
