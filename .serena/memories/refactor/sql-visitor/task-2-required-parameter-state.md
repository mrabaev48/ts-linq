# refactor/sql-visitor/task-2 — Required `ParameterState` (placeholder-numbering guard)

## Outcome
The dangerous per-visitor default `state: ParameterState = new ParameterState(ParameterStyle.Question)`
was **already eliminated by task-1** (`refactor/sql-visitor/task-1-dispatch-registry`): visitors now
take `(node, ctx)` and read `ctx.state`, where `VisitContext.state` is a **required** field. The only
`new ParameterState` in `src/` is the single shared instance in `SqlVisitor.toSql`
(`packages/sql-visitor/src/SqlVisitor.ts`). So task-2 added **regression guards**, not production code.

## What task-2 delivered (no `src/` change)
- **Named unit regression** in `packages/sql-visitor/tests/Visitors.test.ts`:
  top-level `describe('shared ParameterState across visitor calls')` →
  `it('numbers placeholders continuously ($1, $2 not $1, $1)')`. Calls `BinaryVisitor.visit` twice
  with ONE shared `ParameterState(Positional)` via `makeCtx({ state })`, asserting `$1` then `$2`.
- **Type-level guard (tsd)**: new `packages/sql-visitor/test-d/index.test-d.ts` —
  `expectNotAssignable<VisitContext>` for a context literal missing `state`, and
  `expectError(new BinaryVisitor().visit(node, { inputParameters, recurse }))` (missing `state`).
  Added `"test-d": "tsd"` script + `tsd@^0.30.7` devDep to `packages/sql-visitor/package.json`
  (mirrors `metrics-safe`; turbo `test-d` already `dependsOn ["build","^build"]`; no tsd `paths`
  block needed — only the root `.` entrypoint).

## Key decisions
- **Branch**: `audit-refactor/sql-visitor-required-parameter-state` from `origin/main`.
  IMPORTANT timing: task-1 (PR #175) merged into `main` mid-task, so branching from main gave the
  VisitContext world (default already gone) — the "task-1 landed" path, not the standalone-required-
  param path the task file assumed.
- **Changeset: NONE.** No `src/` of a versioned package changed (only tests + test tooling + docs),
  so CLAUDE.md §14 does not require one. (Had this been the pre-task-1 world, removing the default +
  making `resolver` required would have been `major`.)
- Path "Add type-level guard + docs" chosen by user; 7 historical default sites (Binary, In, Method,
  EfFunction, Unary, Spatial, Hierarchy) were all already fixed by task-1.

## Validation (all green)
typecheck, sql-visitor lint (0 errors), full unit suite (3041), build, repo `test-d` (35 tasks),
arch:deps / arch:cycles / arch:dead. Integration/e2e not run (no runtime impact; those suites hang
in this env per standing feedback).

## Follow-up / coordination
- task-4 may un-export the internal visitors; the public-surface guards here would then become purely
  internal. The tsd guard still holds (it targets `VisitContext`, which stays exported).
- sql-visitor remains 🔄 In Progress (tasks 3–5 pending).
