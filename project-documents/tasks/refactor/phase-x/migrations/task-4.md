---
status: not-started
phase: phase-x
package: migrations
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: []
related: ["task-2.md", "task-3.md"]
---

# Refactor: Typed error hierarchy for migrations

## Problem

The package has no error model. Failures are signalled with bare `throw new Error('...')`
or `throw new Error(\`Failed … ${error}\`)`, which lose the original cause, have no stable
code for callers to branch on, and carry no structured context (which migration, which
table, which dialect).

## Evidence

- `packages/migrations/src/MigrationRunner.ts:105,140` — `throw new Error(\`Failed to
  apply/rollback migration ${migration.getName()}: ${error}\`)` (cause lost via string
  interpolation).
- `packages/migrations/src/SchemaSnapshot.ts:325` — `throw new Error('SchemaSnapshotBuilder
  requires a provider for actual schema')`.
- `packages/migrations/src/SchemaSnapshot.ts:411` — `throw new Error('Invalid SchemaSnapshot
  JSON')` (no detail on what failed).
- `packages/migrations/src/snapshot/model-snapshot.ts:424` — `throw new Error('Invalid
  ModelSnapshot: expected an object with a "tables" array property.')`.
- `packages/migrations/src/bundle/build-bundle.ts:190,246` — `throw new Error('esbuild is
  required …')` / `Migrations directory does not exist: ${dir}` (valid translation-wrapping,
  but ad-hoc and uncoded).
- `packages/migrations/src/SchemaSnapshot.ts:311-316` — `try { factory() } catch { /* not a
  factory */ }` — valid recovery, but undistinguished from real errors.

## Why this is bad

- Callers (CLI commands, the runner) cannot programmatically distinguish failure modes;
  they must string-match messages.
- Lost `cause` makes production diagnosis hard.
- No structured context for logs/telemetry.

## Target architecture

A small typed error hierarchy rooted at `MigrationError` with a stable `code` (string
enum), structured `context`, and native `cause` (ES2022 `Error.cause`). Aligns with the
error-handling-patterns guidance: typed exceptions at module boundaries, recoverable cases
handled locally, everything else wrapped with cause preserved.

- `MigrationError extends Error { code: MigrationErrorCode; context?: Record<string, unknown>; }`
- Leaves: `MigrationApplyError`, `MigrationRollbackError`, `SnapshotSerializationError`,
  `SnapshotValidationError`, `BundleBuildError`, `ProviderRequiredError`.
- Each carries the relevant context (`version`, `name`, `dialect`, `table`, `dir`).
- A `MigrationErrorCode` union for branching.

## Proposed refactor

1. Add `errors/MigrationError.ts` (base) + leaf classes + the code union.
2. Export them from `index.ts` (additive public API; `minor` changeset).
3. Replace the bare throws above with the typed errors, passing `{ cause }` where an
   underlying error exists.
4. Provide user-safe `.message` strings (no secrets) while keeping `context`/`cause` for
   diagnostics.

## Suggested design patterns

- **Error hierarchy / typed exceptions** — branchable, contextual errors. Why: callers
  branch on `code`, not message strings.
- **Cause chaining (`{ cause }`)** — preserve the original error. Why: diagnosability.
- **Factory helpers (optional)** — `MigrationApplyError.from(version, name, cause)`. Why:
  consistent context population.

## Testing plan

- **Unit:** each error sets `name`, `code`, `context`, and preserves `cause`.
- **Type-level:** `MigrationErrorCode` is exhaustive in a `switch` (compile-time check).
- **Regression:** assertions in runner/serializer tests updated to expect typed errors.

## Acceptance criteria

- [ ] `MigrationError` base + leaf types exist and are exported.
- [ ] All bare `throw new Error` in runner/serializers/bundle are replaced with typed errors.
- [ ] `cause` is preserved wherever an underlying error exists.
- [ ] Messages are user-safe; diagnostic detail lives in `context`/`cause`.
- [ ] A changeset (`minor`) documents the new exported error types.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm tests:unit`, `pnpm build` pass.

## Refactor order

1. Add the hierarchy + exports.
2. Migrate serializers and bundle (low risk).
3. Migrate the runner as part of task-2.

## Notes

This task is a prerequisite for task-2 (the runner consumes `MigrationApplyError` /
`MigrationRollbackError`).
