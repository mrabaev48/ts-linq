# CLAUDE.md — @ts-linq/types

## Role

The **foundation** of the monorepo. Canonical location for all shared types, interfaces, and the
base error hierarchy. Every package imports from here; this package imports from nothing.

## Hard boundaries

- **Zero dependencies.** Never add a `dependencies` or `peerDependencies` entry. If you are
  tempted to import another `@ts-linq/*` package here, the type belongs there, not here.
- **No runtime code** beyond trivial, pure, dependency-free helpers (`ok`, `err`, `isTemplateSqlCache`).
  No classes with behavior, no I/O, no side effects, no `console`.
- This is the only place a contract should be declared once and re-exported elsewhere — avoid
  duplicating these shapes in downstream packages (`SoftDeleteOptions`, `GlobalFilter`, and the
  telemetry info objects have been duplicated before; don't).

## Internal module structure

`src/index.ts` is a thin re-export barrel. Each declaration lives in exactly one concern module:

| Module | Concern |
|---|---|
| `sql.ts` | SQL primitives & query options (`SqlParameter`, `QueryOptions`, `FilteredIncludeSpec`) |
| `logging.ts` | Logger interfaces & telemetry DTOs (depends on `sql.ts`) |
| `dialect.ts` | SQL dialect contract & DML results (depends on `sql.ts`, `metadata.ts`, `stored-procedure.ts`) |
| `middleware.ts` | Middleware hooks & retry policy (depends on `logging.ts`, `metadata.ts`) |
| `config.ts` | Provider & connection configuration (depends on `logging.ts`, `middleware.ts`) |
| `query-filters.ts` | Global & named query filters (depends on `sql.ts`) |
| `results.ts` | `Result<T,E>`, `ok()`, `err()`, fallback types (depends on `sql.ts`) |
| `cache.ts` | Cache interfaces & performance options (depends on `results.ts`) |
| `value-conversion.ts` | Value converters, generators & sequences (no deps) |
| `metadata.ts` | ORM metadata model — central module (depends on `value-conversion.ts`, `query-filters.ts`) |
| `stored-procedure.ts` | SP mapping types (depends on `sql.ts`) |
| `tracking.ts` | Change tracking primitives (no deps) |
| `spatial-hierarchy.ts` | Translator interfaces (no deps) |
| `diagnostics.ts` | Diagnostic config types (no deps) |
| `scaffolding.ts` | DB-First scaffolding types (no deps) |
| `errors.ts` | Base error hierarchy: `OrmError` abstract root, `OrmErrorCode`, `OrmErrorOptions`, and all concrete error classes (no deps) |

The internal dependency graph is a strict DAG — no cycles.

## Public API surface & stability

- The entire package is public API via `src/index.ts`. Treat every exported name as a contract.
- Changing a field's type, removing a field, or renaming an export is a **breaking change** →
  `major` changeset + migration notes. Adding an optional field is `minor`.
- Preserve inference: prefer precise unions and `interface` over widened types; avoid `any`
  (prefer `unknown`).

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/types/`:
- `task-1` ✅ **completed** — barrel split into 15 concern modules; `index.ts` is now a thin facade.
- `task-2` ✅ **completed** — canonical, code-carrying error hierarchy: `abstract class OrmError`
  (root, `code`/`details`/`cause`), the `OrmErrorCode` const-object union, existing errors re-rooted
  under it (backward-compatible — `instanceof` unchanged), and new categories for `core/task-6`
  (`UnsupportedOperationError`, `MetadataError`, `DecoratorUsageError`, `BatchConfigurationError`,
  `InvalidIncludeError`, `OperationAbortedError`). `@ts-linq/ast`'s `AstSqlGenerationError` now
  extends `OrmError`. Requires `ES2022.Error` in `lib` for native `Error` `cause`.
- `task-3` — enforce a public/internal boundary (not yet started).
- `task-4` — additional type-level test coverage (partially addressed by `src/__tests__/exports.check.ts`).

## Tech debt deferred from task-1

- **Subpath exports** (`@ts-linq/types/metadata` etc.) — follow-up task; see task-1.md notes.
- **`EntityAttacher`** — minimal interface placed in `metadata.ts`; upon Queryable refactor,
  consider moving to `@ts-linq/query` or a dedicated `attacher.ts`.
- **Dead exports** — `PerformanceOptionsExtended` and `SoftDeleteOptionsExtended` are backward-compat
  aliases; candidates for removal in a future `major` changeset.

## Validation

```bash
pnpm --filter @ts-linq/types typecheck
pnpm --filter @ts-linq/types lint
pnpm --filter @ts-linq/types build
```

A change here ripples across the whole monorepo — after editing, run `pnpm typecheck` and
`pnpm build` at the root to catch downstream breakage.

## Do / Don't

- **Do** keep types small, composable, and documented with TSDoc.
- **Do** add a changeset for any exported-symbol change.
- **Do** place each new declaration in the correct concern module; do not reopen `index.ts` to add declarations.
- **Don't** introduce circular intent (a type here that only makes sense with a downstream class).
- **Don't** add runtime behavior or dependencies.
- **Don't** add declarations directly to `index.ts` — it is a re-export barrel only.
