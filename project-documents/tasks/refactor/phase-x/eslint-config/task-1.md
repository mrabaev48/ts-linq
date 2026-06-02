---
status: not-started
phase: phase-x
package: eslint-config
priority: P1
effort: M
risk: medium
category: typescript
depends_on: []
related: []
---

# Refactor: Promote bug-hiding lint rules from off/warn to error

## Problem

The shared config disables or downgrades to `warn` a set of typescript-eslint rules that
catch real runtime bugs. Because `warn` never fails CI, these rules provide no enforcement
anywhere in the monorepo — and several are exactly the rules that catch the failure modes a
strongly-typed ORM cares about (unsafe `any` flow, floating promises in tests, stringifying
objects, mismatched enum comparisons, `this`-binding loss).

## Evidence

- `packages/eslint-config/index.mjs:60-64` — entire `no-unsafe-*` family set to `'off'` at
  base; only re-enabled as `'warn'` for src (`:120-126`) and tests (`:134-138`). No level is
  `error`, so unsafe `any` flow never blocks a merge.
- `:140` — `'@typescript-eslint/no-misused-promises': 'off'` in `testOverrides`. This is the
  rule that catches an unawaited promise passed where a non-promise is expected — a classic
  cause of assertions that never run in `it(...)`.
- `:58` — `'@typescript-eslint/no-unnecessary-type-assertion': 'off'` globally — dead `as`
  casts (which mask type drift after refactors) are never reported.
- `:73` — `'@typescript-eslint/no-base-to-string': 'off'` — `${obj}` producing
  `[object Object]` is never flagged.
- `:66` — `'@typescript-eslint/no-unsafe-enum-comparison': 'off'`.
- `:75` — `'@typescript-eslint/unbound-method': 'off'` — `this`-loss bugs unflagged.

## Why this is bad

- A lint rule at `warn` in a CI that only fails on `error` is effectively *off*; the config
  gives a false impression of strictness while enforcing none of these.
- `no-misused-promises` off in tests is the single highest-risk relaxation: a missing `await`
  in a test produces a green run that asserted nothing — false confidence at the test tier.
- The CLAUDE.md project rules mandate "Prefer `unknown` over `any`" and "Avoid introducing
  `any` into public APIs", yet the lint layer cannot enforce the `no-unsafe-*` family.

## Why this is bad (catch-block audit)

Not applicable (config file); the harm is unenforced correctness rules.

## Target architecture

Apply **defense-in-depth via tooling** and a **staged tightening** (Clean Code: make the
build fail on the bugs you care about):

- Promote `no-unsafe-*` to `error` for `src` (keep `warn` for tests if needed short-term),
  `no-misused-promises` to `error` even in tests (with the precise `{ checksVoidReturn }`
  carve-out only if a real pattern needs it), and `no-unnecessary-type-assertion`,
  `no-base-to-string`, `no-unsafe-enum-comparison`, `unbound-method` to at least `warn`→`error`
  on a documented schedule.
- Use a **baseline/ratchet**: size the violation count per rule first, fix or
  file-disable-with-reason, then flip to `error` so it stays fixed.

## Proposed refactor

1. Run `pnpm lint` to enumerate current violations per candidate rule (backlog sizing).
2. Promote the lowest-violation rules to `error` first (`no-unnecessary-type-assertion`,
   `no-base-to-string`).
3. Re-enable `no-misused-promises` for tests; fix floating-promise hits.
4. Promote `no-unsafe-*` to `error` for src; leave tests at `warn` only if backlog is large,
   with a tracking task.
5. Add the self-test fixtures (see eslint-config/task-2) to lock the severities in.

## Suggested design patterns

- **Ratchet / Baseline** — fix-then-enforce per rule. WHY: avoids a giant unreviewable flip.
- **Defense-in-depth** — lint enforces what types alone cannot (floating promises). WHY:
  catches the test-tier false-green class.

## Testing plan

- Self-test fixtures: one `.ts` per promoted rule asserting the config reports `error`.
- Repo-wide `pnpm lint` is clean after each promotion.

## Acceptance criteria

- [ ] `no-misused-promises` is `error` for tests (or scoped carve-out documented).
- [ ] `no-unsafe-*` family is `error` for `src`.
- [ ] `no-unnecessary-type-assertion` and `no-base-to-string` are `error`.
- [ ] Backlog for any rule left at `warn` is tracked with a follow-up.
- [ ] Self-test fixtures lock the severities.

## Refactor order

1. Size backlog.
2. Promote low-violation rules.
3. Re-enable `no-misused-promises` in tests.
4. Promote `no-unsafe-*` for src.

## Notes

- Coordinate the flip with the owning clusters; large `no-unsafe-*` backlogs in provider/SQL
  packages may need their own follow-ups.
