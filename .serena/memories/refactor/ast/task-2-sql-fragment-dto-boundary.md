# refactor ast/task-2 — relocate SQL-fragment DTOs (package-boundary hygiene)

**Status:** ✅ done. Completes the `ast` package (task-1 + task-2 both done).
**Branch:** `audit-refactor/ast-sql-fragment-dto-boundary`.

## Decision: relocate + remove (not document, not deprecated re-export)

Investigation (grep across whole repo, excl. `dist`/`node_modules`):
- Sole definition was `packages/ast/src/types.ts`.
- **Every consumer lives in exactly one package — `@ts-linq/sql-visitor`** (`SqlVisitor.ts` +
  all `visitors/*.ts`). Zero consumers in core/query/types/dialects/orm/apps/tests. All `import type`.
- → decision-matrix "all consumers in SQL-generation layer → relocate".

**Why the task brief's `@deprecated` re-export from `ast` was rejected:** `@ts-linq/ast` may
depend **only** on `@ts-linq/types` (hard boundary in `packages/ast/CLAUDE.md`). A re-export
`export type {…} from '@ts-linq/sql-visitor'` in `ast` would add an `ast → sql-visitor` dep →
boundary violation + dependency cycle (`arch:deps`/`arch:cycles` fail). The legal direction is
always `sql-visitor → ast`. So relocation necessarily means **remove from ast** (major), no shim.

## Changes
- New `packages/sql-visitor/src/types.ts` — owns `ConditionFragment { condition, parameters }`
  and `SqlFragment { fragment, params }` (imports `SqlParameter` from `@ts-linq/types`).
- `sql-visitor/src/index.ts` re-exports both (additive).
- ~10 sql-visitor source files repointed `import type {...}` from `@ts-linq/ast` → local
  `./types` / `../types`.
- `packages/ast/src/types.ts` **deleted**; `export * from './types'` removed from ast barrel.

## Boundary invariant confirmed
`@ts-linq/ast` deps = `{ @ts-linq/types }` only. Pure node-definitions + Specification + typed
`AstSqlGenerationError`, **zero SQL-string generation**. `arch:deps` (848 modules) and
`arch:cycles` (440 files) both clean — no SQL-generation dep, no new cycle.

## Validation — all green
typecheck (32), lint (0 errors), test:unit (3027), test:integration (464 +2 skip), test:e2e
(290), build (32), arch:deps ✓, arch:cycles ✓, arch:dead ✓.

## Changeset
`@ts-linq/ast`: **major** (removed public types `ConditionFragment`/`SqlFragment`).
`@ts-linq/sql-visitor`: **minor** (now exports them). Migration: import from `@ts-linq/sql-visitor`.

## Follow-up
None pending for this task (no deprecation shim exists). Standing reminder: never re-introduce
SQL-string generation into `@ts-linq/ast`. Next in strict-sequential order: `sql-visitor` (step 5).
