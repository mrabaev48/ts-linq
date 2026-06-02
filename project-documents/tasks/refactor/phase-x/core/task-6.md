---
status: not-started
phase: phase-x
package: core
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: ['types/task-2.md']
related: ['core/task-5.md']
---

# Refactor: Replace generic `throw new Error(...)` with typed errors in core

## Problem
Core throws bare `Error` in 22 places, even though a typed error hierarchy already exists
(`@ts-linq/types/errors.ts`: `DatabaseError`, `ValidationError`, etc.). Callers cannot
discriminate failures by type or error code; messages are the only signal, which is brittle.

## Evidence
- `packages/core/src/DatabaseProvider.ts:828` — `throw new Error('Provider "..." does not support database sequences...')` (should be a typed `UnsupportedOperationError`/`ProviderCapabilityError`).
- `packages/core/src/DatabaseProvider.ts:282,289` — `throw new Error('Operation aborted')` (should be a typed `OperationAbortedError`, ideally a `DOMException`-like AbortError).
- `packages/core/src/loading/EntityLoader.ts:320` — `throw new Error(\`Invalid include '${inc}' ...\`)` (should be `ValidationError` or a typed `InvalidIncludeError`).
- `packages/core/src/decorators/*.ts` (e.g. `CachePolicy.ts:36`, `ValidIf.ts:22,58,87,112,137,162`) — `throw new Error('@X requires TS5 Stage-3 decorators')` (should be a typed `DecoratorUsageError`).
- `packages/core/src/utils/IndexOptionsBuilder.ts:72,75` — config validation `throw new Error(...)` (should be `ValidationError`).
- `packages/core/src/batch/*.ts` (`BatchOperations.ts:135,197`, `BatchInsertOperation.ts:24`, `BatchUpdateOperation.ts:14,22,32`, `BatchUpsertOperation.ts:10`, `BatchDeleteOperation.ts:10,18`) — metadata/precondition `throw new Error(...)` (should be typed `MetadataError`/`BatchConfigurationError`).

## Why this is bad
- **Caller ergonomics**: consumers must string-match messages to handle specific failures.
- **Stability**: message text becomes a de-facto API; refactoring messages breaks consumers.
- **Inconsistency**: a typed hierarchy exists but is partially used (e.g. `metadata` uses `ValidationError`, core does not).
- **Observability**: no error codes/context payloads for structured logging.

## Target architecture
Extend the existing `@ts-linq/types` error hierarchy with the missing categories
(`UnsupportedOperationError`, `OperationAbortedError`, `DecoratorUsageError`,
`MetadataError`, `BatchConfigurationError`, `InvalidIncludeError`), each with a stable
`code` and optional context payload, preserving `cause`. Replace bare throws with these.
This mirrors the well-structured `AstSqlGenerationError` (`@ts-linq/ast/errors.ts`) which
already carries `code` + `details`.

## Proposed refactor
1. In `@ts-linq/types/errors.ts` (or a split per `types/task-1`), add the missing typed errors with `code` and `details` fields (model after `AstSqlGenerationError`).
2. Replace each `throw new Error(...)` in core with the appropriate typed error.
3. Keep messages identical where they are part of documented behaviour; add a `code`.
4. Add `cause` where the throw wraps another failure.
5. Tests assert error *type* and *code*, not message text.

## Suggested design patterns
- **Typed exception hierarchy** rooted at a common `OrmError` base with `code`.
- **Error code enum** for stable discrimination.
- **Factory methods** (`MetadataError.noPrimaryKey(entity)`) for consistent construction.

## Testing plan
- Unit: each replaced throw raises the expected typed error + code.
- Type-level: typed errors are exported and assignable to `OrmError`.
- Regression: existing tests that assert on `Error` still pass (typed errors extend `Error`).

## Acceptance criteria
- [ ] No bare `throw new Error(` in `packages/core/src` non-test code (except where a typed error is genuinely inappropriate, documented inline).
- [ ] New typed errors exported from `@ts-linq/types`.
- [ ] Errors carry stable `code` values.
- [ ] Cluster validations pass.

## Refactor order
After `types/task-2` defines the consolidated error module. Can run in parallel with `core/task-5` (silent-swallow fixes) since they touch complementary sites.

## Notes
The decorator "requires Stage-3 decorators" throws are environment/capability guards; a single `DecoratorUsageError` with the decorator name in context is cleaner than 7 distinct messages.
