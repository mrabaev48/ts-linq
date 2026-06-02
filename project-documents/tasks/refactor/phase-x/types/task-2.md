---
status: completed
phase: phase-x
package: types
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: []
related: ['core/task-6.md', 'ast/task-1.md']
---

# Refactor: Consolidate and standardize the shared error hierarchy in `@ts-linq/types`

## Problem
The shared error hierarchy in `packages/types/src/errors.ts` is small and inconsistent, and
it is duplicated/diverged from the well-structured `AstSqlGenerationError` in
`@ts-linq/ast`. The types errors lack a common root, lack error codes, lack context payloads,
and inconsistently preserve `cause` (some accept it, most do not). This forces downstream
packages (notably core, with 22 bare `throw new Error`) to either string-match or invent
their own errors.

## Evidence
- `packages/types/src/errors.ts`:
  - `DatabaseError` (line 3) — has `cause` but no `code`/`name` enum.
  - `OptimisticConcurrencyError` (13), `UniqueConstraintError` (20), `ForeignKeyConstraintError` (31) extend `DatabaseError` — ad-hoc optional `table`/`column`/`constraint` fields, no codes.
  - `ValidationError` (42) and `TemporalNotSupportedError` (55) extend `Error` directly — **not** part of the `DatabaseError` tree, so they cannot be caught uniformly.
- Contrast: `packages/ast/src/errors.ts:37` `AstSqlGenerationError` carries `code` (typed union) + `details` payload + `name` — the model the types errors should follow.
- No common `OrmError` base across the project; consumers cannot do `catch (e) { if (e instanceof OrmError) … }`.

## Why this is bad
- **Caller ergonomics**: failures cannot be discriminated by a stable code; `ValidationError` is unreachable via the `DatabaseError` catch.
- **Inconsistency**: two error styles coexist (rich `AstSqlGenerationError` vs bare types errors).
- **Observability**: no context payloads for structured logging; partial `cause` preservation hampers root-cause analysis.

## Target architecture
Define a single `OrmError` root carrying `code: string`, optional `details` payload, and
`cause` (preserved via the standard `Error` `cause` option). Re-root all shared errors under
it. Provide a stable `ErrorCode` union/enum. Standardize the `AstSqlGenerationError` to also
extend `OrmError` (or share the contract) so the whole project has one taxonomy. This is the
foundation that `core/task-6` (typed throws) and `core/task-5` (no silent swallow) build on.

## Proposed refactor
1. Add `abstract class OrmError extends Error { readonly code: string; readonly details?: Record<string, unknown>; constructor(code, message, opts?: { cause?; details? }) }`.
2. Re-root `DatabaseError`, `ValidationError`, `TemporalNotSupportedError`, constraint errors under `OrmError`, each with a stable `code`.
3. Add the missing categories needed by core (`UnsupportedOperationError`, `MetadataError`, `DecoratorUsageError`, `BatchConfigurationError`, `InvalidIncludeError`, `OperationAbortedError`).
4. Align `AstSqlGenerationError` to extend `OrmError` (keep its `code`/`details`).
5. Preserve backward compatibility: existing class names and `instanceof Error` behaviour unchanged; only the base broadens.

## Suggested design patterns
- **Typed exception hierarchy** rooted at `OrmError`.
- **Error code enum** for stable discrimination.
- **Factory methods** for consistent construction with context.
- **Result/Either** (optional) for boundary APIs that prefer non-throwing returns.

## Testing plan
- Type-level: every shared error is assignable to `OrmError`; `code` present.
- Unit: `cause` is preserved and reachable.
- Regression: existing `instanceof DatabaseError`/`ValidationError` checks still pass.

## Acceptance criteria
- [ ] `OrmError` root exists with `code` + `details` + `cause`.
- [ ] `ValidationError`/`TemporalNotSupportedError` re-rooted so a single catch covers all ORM errors.
- [ ] Missing categories for core added and exported.
- [ ] `AstSqlGenerationError` aligned to the taxonomy.
- [ ] Monorepo validations pass; backward-compatible.

## Refactor order
Do after `types/task-1` (module split) so errors land in a dedicated module. Prerequisite for
`core/task-6` and complements `ast/task-1`.

## Notes
Broadening a base class is additive (non-breaking) as long as constructors stay compatible;
adding new exported error classes is a `minor` changeset.
