---
status: completed
phase: phase-x
package: orm
priority: P1
effort: M
risk: medium
category: error-handling
depends_on: []
related: ["task-2.md"]
---

# Refactor: Introduce a typed ORM error hierarchy

## Problem

`@ts-linq/orm` throws bare `new Error(string)` for distinct, programmatically-
meaningful failure modes, and its two existing custom exceptions lack error
codes, structured context, and `cause` preservation. Callers cannot reliably
discriminate failure types except by string matching.

## Evidence

Bare `Error` throws (no type, no code, no context):

- `DbContext.ts:276` — `DbSet for ${name} is not configured`.
- `DbSet.ts:181-184` — `DbSet<...> has no database context`.
- `DbSet.ts:758` — `No primary key defined for ${name}` (upsert).
- `DatabaseFacade.ts:46-50` — `Migrations directory is not configured`.
- `EntityTypeBuilder.ts:363-366` — transformer-missing for `hasQueryFilter`.
- `query`/pagination delegate throws (`paginate requires page >= 1`,
  `keysetPaginate requires size >= 1`) — adjacent to ORM surface.

Existing typed exceptions are thin:

- `exceptions/DbUpdateConcurrencyException.ts` — extends `Error`, carries
  `entries` but no code, no `cause`.
- `exceptions/KeylessMutationError.ts` — extends `Error`, no code, no `cause`.

## Why this is bad

- Consumers must string-match messages to branch on failure (fragile, i18n-
  hostile).
- No `cause` chaining means root causes (provider errors wrapped during
  translation) are lost.
- Inconsistent with the project's target error model (typed errors, codes,
  context, cause preservation, user-safe messages).
- Mixed concerns: configuration errors (developer mistakes) and runtime errors
  (concurrency, keyless) are indistinguishable by type.

## Target architecture

A small, cohesive exception hierarchy under `src/exceptions/`, rooted at an
`OrmError` base that standardizes code + context + cause:

```
OrmError (abstract: code: string, context?: Record<string, unknown>, cause?)
 ├─ OrmConfigurationError      // dev mistakes: set not configured, no PK, no ctx,
 │                             //   migrations dir missing, transformer missing
 ├─ DbUpdateException          // generic persistence failure (wraps provider)
 │   └─ DbUpdateConcurrencyException (existing — re-parented, gains code + cause)
 └─ KeylessMutationError       // re-parented, gains code
```

Each error: a stable `code` (e.g. `ORM_SET_NOT_CONFIGURED`,
`ORM_NO_PRIMARY_KEY`, `ORM_TRANSFORMER_REQUIRED`,
`ORM_UPDATE_CONCURRENCY`), structured `context`, `cause` via the standard
`Error` `{ cause }` option, and a user-safe `message`. Apply the
error-handling-patterns skill's exception-hierarchy guidance.

## Proposed refactor

1. Add `OrmError` base (abstract) with `code`, optional `context`, `cause`
   plumbed through `super(message, { cause })`.
2. Add `OrmConfigurationError` and `DbUpdateException`.
3. Re-parent `DbUpdateConcurrencyException` under `DbUpdateException`; add a
   `code` and pass the originating `OptimisticConcurrencyError` as `cause` at the
   translation site (`DbContext.ts:460-465`).
4. Re-parent `KeylessMutationError` under `OrmConfigurationError` (or a sibling),
   add a `code`.
5. Replace each bare `throw new Error(...)` listed above with the appropriate
   typed error, preserving the existing message text for backward compatibility.
6. Export the new error classes from the public barrel (they are part of the
   catchable API contract).

## Suggested design patterns

- **Exception hierarchy / typed errors** — discriminable failures with codes
  (extensibility: new failure modes slot under a stable root).
- **Error translation boundary** — wrap provider/concurrency errors at the ORM
  boundary with `cause` preserved (no information loss).
- **Factory helpers** (optional) — `OrmConfigurationError.setNotConfigured(name)`
  to keep call sites terse and codes centralized.

## Testing plan

- **Unit:** each error constructs with correct `code`, `context`, `cause`, and
  `name`; `instanceof OrmError` holds for all.
- **Regression:** `tests/db-update-concurrency-exception.test.ts` and
  keyless-entity tests still pass; message text unchanged where asserted.
- **Error-path:** concurrency translation preserves `cause`
  (`OptimisticConcurrencyError`).
- **Type-level:** `catch` narrowing via `instanceof` works for each subtype.

## Acceptance criteria

- [ ] `OrmError` base with `code`/`context`/`cause` exists.
- [ ] All bare `throw new Error` in the listed locations replaced with typed
      errors (messages preserved).
- [ ] `DbUpdateConcurrencyException` and `KeylessMutationError` re-parented and
      carry codes; concurrency translation passes `cause`.
- [ ] New errors exported from the public barrel.
- [ ] `pnpm typecheck && pnpm lint && pnpm tests:unit` pass.

## Refactor order

1. `OrmError` base + two mid-level classes.
2. Re-parent existing exceptions (keep public names/exports).
3. Swap bare throws site-by-site.

## Notes

Keep message strings identical where existing tests assert on them to avoid
incidental breakage; the code/context/cause additions are purely additive.
Coordinate with task-2 (catch reclassification) so wrapped errors use the new
hierarchy with `cause`.
