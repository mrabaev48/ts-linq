---
status: not-started
phase: phase-x
package: composite-sql-logger
priority: P2
effort: S
risk: low
category: error-handling
depends_on: ["composite-sql-logger/task-1.md"]
related: ["cache-redis/task-4.md", "metrics-safe/task-2.md"]
---

# Refactor: Route delegate/factory errors instead of console.warn/silent catch

## Problem

When a delegate logger throws, `CompositeSqlLogger` writes to `console.warn`
(15 sites). When a `SqlLoggerFactory` throws during `create`,
`CompositeSqlLoggerFactory` swallows it with an empty `catch {}`. Neither path is
routable, level-controlled, or observable — the same library-emits-to-stdout /
silent-swallow anti-pattern flagged elsewhere in the cluster.

## Evidence

- 15 `console.warn('[CompositeSqlLogger] <method> delegate error', e)` calls in
  `packages/composite-sql-logger/src/logger/CompositeSqlLogger.ts` (e.g. lines 25,
  34, 43, 52, 61, 70, 79, 88, 97, 106, 115, 124, 133, 142, 151).
- `CompositeSqlLoggerFactory.create` — `CompositeSqlLoggerFactory.ts:19-25`:
  `try { const l = f?.create(provider); ... } catch { /* ignore */ }` — a
  factory that throws is silently dropped from the composite.

## Why this is bad

- **`console.warn` from a library.** Cannot be suppressed, leveled, or
  redirected; pollutes consumer stdout. A noisy/broken delegate could spam the
  console on every query.
- **Silent factory swallow.** A misconfigured provider-specific logger factory
  vanishes with no diagnostic — the operator never learns their OTel/Prometheus
  logger failed to attach.
- **Inconsistent policy.** Isolating a delegate's exception is the *correct*
  intent (one bad logger must not break logging), but the reporting of that
  isolation is ad-hoc.

## Target architecture

Keep the (correct) isolation behaviour, but make the *reporting* configurable via
an injected error handler — a small **Strategy**/**Null Object**:

- Add an optional `onError?: (context: { method?: string; provider?: string },
  error: unknown) => void` to both the composite and the factory. Default is a
  no-op (Null Object) so the library is silent by default, not console-spamming.
- Centralize delegate-error reporting in the `dispatch` helper from task-1 so it
  is defined once.
- For the factory, on a thrown `create`, call `onError` (with the provider) before
  skipping that factory.
- Optionally reuse `@ts-linq/metrics-safe`'s safe-invoke (metrics-safe/task-2) for
  the reporting call so the error handler itself cannot break logging.

## Proposed refactor

1. Add `onError` option to `CompositeSqlLogger` and `CompositeSqlLoggerFactory`.
2. Replace the 15 `console.warn`s with one `this.reportDelegateError(method, e)`
   in `dispatch` (task-1) calling `onError`.
3. Replace the factory's empty `catch {}` with an `onError` call.
4. Default `onError` to no-op (silent), document how to opt into reporting.

## Suggested design patterns

- **Strategy:** pluggable error handler.
- **Null Object:** default no-op handler removes branching and keeps silence by
  default.
- **DIP:** composite depends on the handler abstraction, not `console`.

## Testing plan

- Unit: a throwing delegate invokes `onError` once with the method name; other
  delegates still receive the event.
- Unit: default (no `onError`) does not call `console.*`.
- Unit: a throwing factory invokes `onError` with the provider and is skipped;
  remaining factories/static loggers still compose.

## Acceptance criteria

- [ ] No `console.*` calls remain in the package.
- [ ] Delegate and factory errors are reported through an injectable handler.
- [ ] Default behaviour is silent (no stdout pollution).
- [ ] Delegate-error isolation behaviour is preserved (one bad logger ≠ broken
      logging).

## Refactor order

1. Land task-1 (central `dispatch`).
2. Add `onError` to composite + factory.
3. Replace console.warn / silent catch.

## Notes

The isolation itself is VALID (a logger must never break the query path) — the
defect is unroutable `console.warn` and a silent factory swallow. Default stays
quiet; reporting becomes opt-in.
