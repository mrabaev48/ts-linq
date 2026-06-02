---
status: not-started
phase: phase-x
package: dialect-postgres
priority: P2
effort: S
risk: low
category: error-handling
depends_on: ['dialect-postgres/task-4.md']
related: ['dialect-postgres/task-4.md']
---

# Refactor: Replace silent `JSON.stringify` catch-and-swallow in parameter coercion

## Problem
The parameter-coercion fallback wraps `JSON.stringify` in a `try { ... } catch {}` that, on failure (e.g. a
circular reference or a `BigInt`), silently falls back to `String(value)`. This produces a corrupted SQL
parameter (`"[object Object]"`) with no diagnostic, turning a programmer error into silent data corruption.

## Evidence
- `PostgresDialect.ts:353-357` `try { return JSON.stringify(value ?? null); } catch { return String(value); }`.
- `MssqlDialect.ts:316-320` — identical.
- `MysqlDialect.ts:265-269` — identical.
- `dialect-postgres/src/batch-syntax.ts:40-44` and `dialect-mssql/src/batch-syntax.ts:24-28` — identical.

Classification: **unsafe silent fallback** — the catch discards the real error and substitutes a lossy value.

## Why this is bad
- Clean Code / error-handling: swallowing the exception hides the root cause (circular ref / BigInt / Symbol)
  and the resulting `String(value)` writes garbage to the database with no signal.
- Inconsistent with the rest of the package, which throws descriptive errors (e.g. `MssqlDdlStrategy.ts:15`,
  temporal `assertDate` in `emit-temporal.ts:58`).

## Target architecture
- Centralize coercion (see task-4) and, on serialization failure, throw a **typed, descriptive error**
  (e.g. `ParameterCoercionError` carrying the column/property name and the original cause) rather than
  silently degrading. Pokemon-style swallow is forbidden for data-path code.

## Proposed refactor
1. In the shared `coerceSqlParameter`, replace `catch { return String(value) }` with
   `catch (cause) { throw new ParameterCoercionError(..., { cause }) }`.
2. Add `ParameterCoercionError` to `@ts-linq/types` error hierarchy.
3. Optionally support `BigInt` explicitly (provider-dependent) before falling through.

## Suggested design patterns
- **Typed error hierarchy** with `cause` chaining. WHY: fail-fast with actionable context instead of corrupt writes.

## Testing plan
- Unit: circular object → throws `ParameterCoercionError` (not silent `"[object Object]"`).
- Unit: plain object → JSON string (unchanged happy path).

## Acceptance criteria
- [ ] No silent `catch { return String(value) }` remains in coercion paths.
- [ ] `ParameterCoercionError` thrown with cause + identifier context.
- [ ] Happy-path serialization behavior unchanged; tests pass.

## Refactor order
1. Add error type. 2. Update shared coercion (depends_on task-4). 3. Tests.

## Notes
Cross-dialect; best done as part of task-4 extraction so the change lands in one place.
