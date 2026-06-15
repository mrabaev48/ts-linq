# refactor migrations/task-4: typed error hierarchy

✅ DONE — migrations' 2ND task (pulled ahead of task-2/task-3 to satisfy task-2's
`depends_on`: the runner consumes `MigrationApplyError`/`MigrationRollbackError`).

## CLAUDE.md §16 reconciliation
The task file proposed a standalone `MigrationError extends Error` + `MigrationErrorCode`.
That was **rejected** per §16. Instead all migration errors extend the canonical `OrmError`
root in `@ts-linq/types`, codes are new literals on `OrmErrorCode` (no parallel hierarchy).

## What changed
- `packages/types/src/errors.ts`: 6 new `OrmErrorCode` literals + 6 classes, all
  `extends OrmError` with `(message, opts?: OrmErrorOptions)` ctor:
  - `MigrationApplyError` (MIGRATION_APPLY_ERROR) — `static from(version,name,cause)`
  - `MigrationRollbackError` (MIGRATION_ROLLBACK_ERROR) — `static from(version,name,cause)`
  - `SnapshotSerializationError` (SNAPSHOT_SERIALIZATION_ERROR) — wraps JSON.parse failures
  - `SnapshotValidationError` (SNAPSHOT_VALIDATION_ERROR) — structurally-invalid snapshot/seed
  - `BundleBuildError` (BUNDLE_BUILD_ERROR) — esbuild missing / dir missing
  - `ProviderRequiredError` (PROVIDER_REQUIRED_ERROR) — operation needs a provider
  The `from()` factories build user-safe messages (no raw cause interpolation); diagnostics
  live in `cause` + `details`.
- `packages/types/src/index.ts`: 6 names added to the named `./errors` re-export.
- `packages/migrations/src/errors.ts`: NEW thin re-export of the 6 classes from
  `@ts-linq/types` (ergonomics); barrel-exported from migrations `index.ts`.

## Sites migrated (non-runner only; runner DEFERRED to task-2)
- `SchemaSnapshot.ts:326` → `ProviderRequiredError` (details: {operation})
- `SchemaSnapshot.ts` deserialize → JSON.parse wrapped → `SnapshotSerializationError({cause})`;
  assertValid → `SnapshotValidationError`
- `snapshot/model-snapshot.ts` deserialize → same parse/validate split
- `bundle/build-bundle.ts:190` → `BundleBuildError({cause, details:{reason:'esbuild-missing'}})`
- `bundle/build-bundle.ts:246` → `BundleBuildError({details:{dir}})`
- `seed/SeedDiff.ts:23` → `SnapshotValidationError({details:{table, missingColumns}})`
  (discovered by grep, not in task's explicit list, but in scope)
- `MigrationRunner.ts:105,140` left as bare throws ON PURPOSE → task-2.
- Factory-probe `SchemaSnapshot.ts:311-316` kept (legitimate single capability probe, §16 r3).

## Tests
- `types/src/__tests__/errors.test.ts`: +6 classes (instanceof/code literal/cause/details +
  `from()` factory assertions incl. "message does not leak raw cause").
- `types/tests/type-exports.test.ts`: updated BOTH the `should export all error classes` list
  AND the `expectedExports` manifest array (else it fails).
- migrations regression tests rewritten to assert `instanceof`+`code` (not message text):
  model-snapshot.unit.test, SeedDiff.test, bundle/build-bundle.unit.test.

## Versioning
- `@ts-linq/types` minor 4.5.0 → 4.6.0; `@ts-linq/migrations` patch 2.6.29 → 2.6.30.
- `pnpm changeset version` cascaded patch bumps to all downstream dependents of types
  (standard changesets behavior with workspace deps).

## Validation — ALL GREEN
typecheck, lint (0 err), test:unit (3491 pass; 1 flaky SIGSEGV worker on
query/InheritanceQueryPlanner — passes in isolation, unrelated), test:integration (461),
test:e2e (290), build, arch:deps/cycles/dead all clean.

Gotcha: rebuild `@ts-linq/types` dist (`pnpm --filter @ts-linq/types build`) before typecheck.

Next migrations = task-2 (decompose MigrationRunner — consumes MigrationApply/RollbackError).
