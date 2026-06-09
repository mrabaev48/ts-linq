# refactor sql-visitor/task-5: JsonAccessRewriter fail-loud on JSON paths in isNull/method

**Status: ✅ completed.** Branch `audit-refactor/sql-visitor-json-rewrite-fail-loud`.

## Problem
`JsonAccessRewriter.rewrite()` (`packages/sql-visitor/src/JsonAccessRewriter.ts`) rewrites
multi-segment property paths into `JsonPathExpression`. In the `isNull`/`isNotNull` and
`method` branches it **silently returned the un-rewritten node** when the property resolved to
a JSON path, with a misleading comment "dialects handle IS NULL on JSON paths" → silent-wrong
SQL against a non-existent multi-segment column.

## Policy decision → Option B (fail-loud), NOT AST widening
Confirmed via exploration that **no dialect supports it**:
- All 3 `JsonPathTranslator`s (`dialect-postgres|mssql|mysql/src/json/JsonPathTranslator.ts`)
  emit scalar extraction only (`->>`, `JSON_VALUE`, `JSON_EXTRACT`). No context-aware
  `IS NULL`/`LIKE` form.
- `NullVisitor`/`MethodVisitor` call `renderPropertyName(PropertyNode)` (zero JSON handling).
- AST types `IsNullNode.property` / `IsNotNullNode.property` / `MethodNode.object` are
  `PropertyNode`-only — a JSON path can't even legally sit there.
- Only `BinaryVisitor.renderOperand` delegates JSON via `recurse()` → works for equality only.
Full support (AST widening + visitors + 3 dialects) = large feature, no demand → **deferred to
task-6**.

## Changes
1. `@ts-linq/ast` (`src/errors.ts`): added `'UNSUPPORTED_JSON_POSITION'` to
   `AstSqlGenerationErrorCode`. `AstSqlGenerationErrorDetails` already had `column?`/`path?`.
   → **minor** changeset.
2. `@ts-linq/sql-visitor` (`src/JsonAccessRewriter.ts`): value-import `AstSqlGenerationError`
   from `@ts-linq/ast`; both `return node;` silent-drops now `throw` via one shared private
   `unsupportedJsonPosition(position, rewritten)` helper (details: `nodeType`/`column`/`path`);
   misleading comment removed. → **patch** changeset.
3. Tests (`tests/json-access-rewriter.test.ts`, additive): throw+code+details for
   isNull/isNotNull/method JSON paths; scalar-property pass-through guards. Existing tests
   untouched.

## Error pattern for this position
`throw new AstSqlGenerationError('UNSUPPORTED_JSON_POSITION', "JSON path in '<pos>' position is
not supported by any dialect. Use a scalar property, or compare the JSON value directly (=== /
!== null).", { nodeType, column, path })`. AstSqlGenerationError lives in `@ts-linq/ast` and is
rooted under `OrmError` (types/task-2); it uses its own `AstSqlGenerationErrorCode` union, NOT
`OrmErrorCode`.

## Dial-in point for future Option B
`task-6.md` (new follow-up, P2, depends_on task-5): widen `IsNullNode.property` /
`IsNotNullNode.property` / `MethodNode.object` to `PropertyNode | JsonPathExpression`; teach
NullVisitor/MethodVisitor to render via the `JsonPathTranslator` port; add context-aware
`IS NULL`/`LIKE` emission to all 3 dialect translators; replace the task-5 throw with
propagation. Trigger: a dialect adds the support, or a consumer needs the predicate.

## Gotcha
sql-visitor typechecks against `@ts-linq/ast`'s built `.d.ts` → must `pnpm --filter @ts-linq/ast
build` after editing ast's errors.ts, else `UNSUPPORTED_JSON_POSITION` is "not assignable".

## Validation (all green)
typecheck, lint (0 err), test:unit (3050; 1 flaky SIGSEGV in provider-mssql worker, passes in
isolation), test:integration (464 +2 pre-existing skips), test:e2e (290), build, arch:deps,
arch:cycles, arch:dead.

## README state
- sql-visitor package → **✅ Done** (tasks 1-5; task-6 optional follow-up).
- refactor/README.md strict-sequential: step 5 sql-visitor ✅ done; step 6 concurrency advanced
  to 🔄 In Progress. Completion table: sql-visitor 6 tasks / Total 179.

## Script name gotcha
Root scripts are `test:unit` / `test:integration` / `test:e2e` (CLAUDE.md §5 lists
`tests:unit`/`tests:e2e` which don't exist). `pnpm run test:all` = unit+integration+e2e.
