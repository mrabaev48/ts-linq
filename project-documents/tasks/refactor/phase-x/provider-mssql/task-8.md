---
status: not-started
phase: phase-x
package: provider-mssql
priority: P1
effort: S
risk: medium
category: error-handling
depends_on: []
related: ["provider-mysql/task-8.md"]
---

# Refactor: Classify and fix silent catch blocks in MSSQL disconnect / rollback / explain paths

## Problem
`MssqlProvider` has several `catch {}` blocks that swallow errors without logging or state
verification, assuming a state (aborted tx, closed pool) without confirming it. Some are
defensible; others hide real failures and leave the provider in an inconsistent state.

## Evidence & classification
- `doDisconnect` rollback swallow `MssqlProvider.ts:166-173`:
  ```
  try { await this.tx.rollback(); } catch { /* ignore */ }
  this.tx = null;
  ```
  **Borderline.** Acceptable to ignore rollback-of-aborted-tx, but it is not logged and `tx` is
  nulled regardless — a non-abort failure is invisible. Should log at debug.
- `doDisconnect` pool-close swallow `:174-181`:
  ```
  try { await this.pool.close(); } catch { /* ignore */ }
  this.pool = null;
  ```
  **Invalid silent swallow.** A failed close (leaked sockets) is hidden; `isConnected` is still
  set false at `:182`, so the caller believes shutdown succeeded. Must log; consider surfacing.
- `doRollbackTransaction` swallow `:520-525` `try { await tx.rollback(); } catch { /* already aborted */ }`:
  **Defensible** (MSSQL auto-aborts on error) but unlogged — keep behavior, add debug log.
- `getExplainPlan` nested swallows `:478-490` (XML fallback then outer `return undefined`):
  **Defensible** — explain is best-effort, returning `undefined` is the documented contract. Keep,
  but route through the internal logger at debug to aid diagnosis.

## Why this is bad
- Silent pool-close failures cause resource leaks that are invisible in production.
- "Assume-state-without-verifying" makes incident triage impossible (no log breadcrumb).
- Inconsistent with `DatabaseProvider`'s use of `logInternalError` elsewhere (`core/src/DatabaseProvider.ts:440`).

## Target architecture
Adopt a single internal-logging convention for swallowed errors (reuse `logInternalError` /
`warnIfLoggerDebug` from `@ts-linq/metrics-safe`). Distinguish *expected* swallows (logged at
debug) from *unexpected* ones (logged at warn, optionally rethrown). Clean Code: no empty catch
blocks; every catch records intent.

## Proposed refactor
1. Replace `catch { /* ignore */ }` with `catch (e) { logInternalError('MssqlProvider.doDisconnect.close', e); }` for the pool-close path.
2. Add debug logging to the two defensible rollback swallows; keep behavior.
3. Add debug logging to `getExplainPlan` fallbacks.
4. Document each remaining intentional swallow with a one-line rationale.

## Suggested design patterns
- **Null Object / best-effort with observability** — best-effort operations still emit a breadcrumb.

## Testing plan
- Unit (fake driver, `task-7.md`): make `pool.close()` reject → assert the error is logged and `disconnect` still completes.
- Unit: make `tx.rollback()` reject in disconnect → assert logged, `tx` cleared.
- Regression: normal disconnect/rollback unaffected.

## Acceptance criteria
- [ ] No empty `catch {}` remains in disconnect/rollback/explain.
- [ ] Pool-close failures are logged (warn), not silently dropped.
- [ ] Defensible swallows are logged at debug with a rationale comment.
- [ ] Unit tests assert logging on each failure path.

## Refactor order
Independent; best landed with or after `task-7.md` (fake driver enables failure injection).

## Notes
MySQL has analogous unlogged transaction paths (`provider-mysql/task-8.md`). Postgres already
rethrows in `doBeginTransaction` (`PostgresProvider.ts:475-481`) and is comparatively clean.
