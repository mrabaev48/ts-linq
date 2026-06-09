# refactor/core/task-6 — Typed errors (bare `throw new Error` eliminated)

**Status:** ✅ Completed. Branch `audit-refactor/core-typed-errors`.

## What changed
All 22 bare `throw new Error(...)` sites in `packages/core/src` (non-test) now raise the
consolidated `@ts-linq/types` `OrmError` subclasses (from `types/task-2`) with a stable `code`
and a safe-to-log `details` payload. **Messages unchanged.** **No new error class or
`OrmErrorCode` was needed** — the existing hierarchy already covered every case. `@ts-linq/types`
was NOT modified. No parallel hierarchy added to core.

## Mapping (site → typed error → code)
- `DatabaseProvider.ts` `nextSequenceValue` base impl → `UnsupportedOperationError`
  (`UNSUPPORTED_OPERATION`), `details: { provider, operation:'nextSequenceValue' }`.
- `DatabaseProvider.ts` streamRows abort (2 sites) → `OperationAbortedError` (`OPERATION_ABORTED`).
- `loading/EntityLoader.ts` `validateIncludes` → `InvalidIncludeError` (`INVALID_INCLUDE`),
  `details: { include, entity }`.
- `utils/IndexOptionsBuilder.ts` build() validation (2) → `ValidationError` (`VALIDATION_ERROR`);
  note `ValidationError` ctor is `(message)` only — no opts/details.
- `decorators/CachePolicy.ts` + `decorators/ValidIf.ts` (7 total) → `DecoratorUsageError`
  (`DECORATOR_USAGE_ERROR`), `details: { decorator }`.
- `batch/*` precondition guards → `MetadataError` (`METADATA_ERROR`) / `BatchConfigurationError`
  (`BATCH_CONFIGURATION_ERROR`).

## DRY factories (kept in core, not in types)
- `packages/core/src/decorators/decoratorErrors.ts` → `stage3DecoratorError(decorator)`:
  collapses the 7 duplicated "requires TS5 Stage-3 decorators" throws into one source.
- `packages/core/src/batch/batchErrors.ts` → `metadataNotFound / noPrimaryKeys / noPrimaryKey /
  noInsertableColumns / noTargetEntity / invalidBatchSize`. Each rebuilds the exact prior message
  + `details`. Factories live in core deliberately (don't widen `@ts-linq/types` public API ⇒
  types gets no changeset).

## Tests
New contract file `packages/core/tests-new/TypedErrors.test.ts` (13 cases): asserts
`instanceof` + `code` (+ `details`), never message text. Existing message-based
`rejects.toThrow('...')` tests stay green (typed errors extend `Error`) — nothing weakened.
Private `EntityLoader.validateIncludes` exercised via interface-cast; base
`DatabaseProvider.nextSequenceValue` via a minimal local concrete provider.

## Validation (all green)
typecheck ✓, lint ✓ (0 errors), build ✓, test:unit ✓ (3105), test:integration ✓ (464),
test:e2e ✓ (290), arch:deps ✓, arch:cycles ✓, arch:dead ✓ (factories all referenced).

## Changeset / versions
`@ts-linq/core` → `patch` (3.0.8 → 3.0.9) + dependent patch cascade. No unconsumed changeset
files. `@ts-linq/types` untouched.

## Script-name gotcha
Root scripts are `test:unit` / `test:integration` / `test:e2e` / `test:all` (NOT the
`tests:unit`/`tests:e2e` spelled in CLAUDE.md §5). Arch: `arch:deps`/`arch:cycles`/`arch:dead`.

## Follow-ups / coordination
Complementary to `core/task-5` (silent-swallow fixes) — different sites, no overlap. core
package remains 🔄 in progress (tasks 5, 1, 3, 7, 8, 9 pending). See
[[refactor/types-task-2-error-hierarchy]].
