---
status: not-started
phase: phase-x
package: composite-sql-logger
priority: P1
effort: M
risk: low
category: clean-code
depends_on: []
related: ["composite-sql-logger/task-2.md"]
---

# Refactor: Collapse 15 duplicated fan-out bodies into one generic dispatch

## Problem

`CompositeSqlLogger` repeats the same delegate-fan-out-with-try/catch block
fifteen times — once per `SqlLogger` method. The only difference per method is the
method name and the warning message. This is high-volume duplication that also
causes the coverage drift fixed in task-2 (it is easy to forget to add the loop
for a new method).

## Evidence

`packages/composite-sql-logger/src/logger/CompositeSqlLogger.ts`:

- Identical structure repeated for `debug` (line 20), `info` (29), `warn` (38),
  `error` (47), `queryStart` (56), `queryEnd` (65), `retry` (74),
  `transactionStart` (83), `transactionEnd` (92), `cache` (101),
  `connectionHealth` (110), `circuit` (119), `fallback` (128), `hedgedWin` (137),
  `analysis` (146).
- Each body: `for (const d of this.delegates) { try { d.<m>?.(args) } catch (e) {
  console.warn('[CompositeSqlLogger] <m> delegate error', e); } }`.

## Why this is bad

- **DRY violation, ~135 lines of boilerplate.** Any change to the fan-out policy
  (error handling, ordering, short-circuiting) must be edited 15 times.
- **Drift magnet.** The missing `crossQuery`/`cacheSize` methods (task-2) are a
  direct consequence: the pattern is manual, so methods get forgotten.
- **Noise.** Obscures the single idea ("forward to all delegates, isolate
  errors") behind repetition.

## Target architecture

One generic, type-safe dispatch method; each public method delegates to it. This
is the **Composite** pattern with a single shared traversal:

```ts
private dispatch<M extends keyof SqlLogger>(
  method: M,
  ...args: Parameters<NonNullable<SqlLogger[M]>>
): void {
  for (const d of this.delegates) {
    const fn = d[method] as ((...a: unknown[]) => void) | undefined;
    if (!fn) continue;
    try { fn.apply(d, args); }
    catch (e) { this.reportDelegateError(method, e); }  // see task-3
  }
}

queryStart(info: QueryStartInfo): void { this.dispatch('queryStart', info); }
// ...one-liner per method
```

This applies **DRY**, **SRP** (one place owns fan-out + error policy), and keeps
**OCP** (error policy and coverage handled centrally).

## Proposed refactor

1. Add a private generic `dispatch<M extends keyof SqlLogger>` helper.
2. Reduce every public method to a single `this.dispatch('<name>', ...args)` call.
3. Centralize the error handling in `dispatch` (wire to task-3's reporter).
4. (Coordinated with task-2) ensure all `SqlLogger` methods, including
   `crossQuery`/`cacheSize`, have their one-liner.

## Suggested design patterns

- **Composite:** unchanged intent, single traversal implementation.
- **DRY / SRP:** one fan-out + error policy.

## Testing plan

- Unit: every event reaches every delegate (spy delegates).
- Unit: a throwing delegate does not prevent later delegates from receiving the
  event.
- Type test: `dispatch` only accepts real `SqlLogger` method names and correctly
  typed args.

## Acceptance criteria

- [ ] A single generic `dispatch` helper exists.
- [ ] Each public method is a one-line delegation.
- [ ] No duplicated fan-out/try-catch blocks remain.
- [ ] Behaviour (forward-to-all, isolate errors) is preserved by tests.

## Refactor order

1. Add `dispatch`.
2. Rewrite methods as one-liners.
3. Land alongside task-2 (coverage) so the method set is complete.

## Notes

Type the generic against `SqlLogger` so adding a method to the interface surfaces
a compile gap here (supports task-2's drift guard).
