---
status: completed
phase: phase-x
package: core
priority: P0
effort: M
risk: high
category: error-handling
depends_on: []
related: ['core/task-1.md', 'types/task-2.md']
---

# Refactor: Replace silent-swallow catch blocks in core execution & loading paths

## Problem
`@ts-linq/core` contains many `catch` blocks (45 catch sites under `src`, of which 17 are
bare `catch {` with no binding). Several are **invalid silent swallows** or **invalid
unsafe fallbacks** sitting on the hot execution / loading path, where they hide data-loss
and correctness bugs.

## Evidence (each catch classified)
- `packages/core/src/DatabaseProvider.ts:210` `upsert()` — `try { update } catch { insert }`.
  Classification: **invalid unsafe fallback**. Any update error (deadlock, validation, connection) is treated as "row absent" → spurious insert / duplicate.
- `packages/core/src/OwnedEntityHydrator.ts:55` `hydrateJson` — `JSON.parse` failure → `return undefined`.
  Classification: **invalid silent swallow**. Corrupt JSON column silently yields a missing owned entity with no diagnostic.
- `packages/core/src/loading/EntityLoader.ts:402` `loadRelationshipByType` — `catch (error) { this._logger?.warn(...) }`.
  Classification: **invalid silent swallow (partial success)**. A failed relationship load is logged at warn and the entity is returned partially populated; callers cannot tell the load was incomplete.
- `packages/core/src/loading/EntityLoader.ts:308` `ensureStage3Init` — `void new entityClass(); catch { /* ignore */ }`.
  Classification: **invalid silent swallow**. Constructor-throwing entities are swallowed; relies on side effects of construction.
- `packages/core/src/loading/EntityLoader.ts:494,568` — `crossQuery` logging `catch { /* ignore */ }`.
  Classification: **telemetry-with-rethrow candidate** (currently swallow). Acceptable to not rethrow, but should route through `logInternalError`.
- `packages/core/src/DatabaseProvider.ts:545-586` `mergeLoggers` per-method `catch { /* ignore */ }`.
  Classification: **valid (logger isolation)** but inconsistent — should be unified via `logInternalError` (see `core/task-1` CompositeSqlLogger).
- `packages/core/src/DatabaseProvider.ts:451` plan-stringify `catch { return plan }`.
  Classification: **valid recovery** (size-guard fallback) — keep.

## Why this is bad
- **Data-loss / correctness**: `upsert` fallback can duplicate rows; silent JSON-parse failure loses owned data.
- **Debugging risk**: partial relationship loads produce "missing data" bugs with only a warn log.
- **Inconsistency**: a typed error hierarchy exists (`@ts-linq/types:errors.ts` and `@ts-linq/ast:errors.ts`) but is bypassed by generic swallows.

## Target architecture
Adopt a consistent error policy: distinguish *transient* from *terminal* failures; never
infer control flow from a swallowed exception. Apply Result/Either or typed exceptions at
boundaries, preserve `cause`, and route all "must-not-throw" sites through a single
`logInternalError` channel. Use a `PartialLoadResult` to make partial relationship loads
explicit instead of silent.

## Proposed refactor
1. `upsert`: stop catching to detect existence. Use an affected-rows check (update returns 0 rows ⇒ insert) or a provider `existsByKey` capability. Only fall back on a typed "no rows affected" signal, never on arbitrary errors.
2. `hydrateJson`: on `JSON.parse` failure throw a typed `OwnedEntityHydrationError` (or surface via the diagnostic sink) instead of returning `undefined`; at minimum call `logInternalError`.
3. `loadRelationshipByType`: surface failures via a typed error or an explicit partial-result flag; do not return a half-populated entity silently.
4. `ensureStage3Init`: make construction-for-side-effects explicit and typed, or remove if the metadata path no longer needs it.
5. Route all intentional swallows through `logInternalError(context, e)` for uniformity.
6. Add error-path unit tests for each fixed site.

## Suggested design patterns
- **Result/Either** — model `upsert` and load outcomes as success/failure instead of exception-as-control-flow.
- **Typed exception hierarchy** — extend the existing `DatabaseError` tree in `@ts-linq/types`.
- **Null Object vs explicit error** — replace ambiguous `undefined` returns with explicit signals.
- **Telemetry boundary** — single `logInternalError` channel for must-not-throw sites.

## Testing plan
- Error-path unit: `upsert` rethrows a deadlock instead of inserting a duplicate.
- Error-path unit: corrupt JSON column produces a typed error / diagnostic, not silent `undefined`.
- Error-path unit: failed relationship load is observable to the caller.
- Regression: happy-path upsert/hydration/eager-load behaviour unchanged.

## Acceptance criteria
- [ ] `upsert` no longer uses catch-all to decide insert-vs-update.
- [ ] `hydrateJson` JSON-parse failure is no longer silently swallowed.
- [ ] Relationship-load failures are observable (typed error or partial-result flag).
- [ ] All intentional swallows go through `logInternalError`.
- [ ] Error-path tests added; cluster validations pass.

## Refactor order
Land alongside/just after `core/task-1` so the extracted collaborators adopt the new error model. Depends conceptually on the typed-error consolidation in `types/task-2`.

## Notes
Keep messages user-safe and English (project standard); include `cause` and a context payload for debug-safe diagnostics.
