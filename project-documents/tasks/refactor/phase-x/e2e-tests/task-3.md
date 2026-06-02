---
status: not-started
phase: phase-x
package: e2e-tests
priority: P2
effort: S
risk: low
category: typescript
depends_on: ["e2e-tests/task-2.md"]
related: []
---

# Refactor: Remove `any` from shared setup helpers and correct README drift

## Problem

The shared e2e setup helpers use `any` for the provider type, suppressing the eslint
`no-explicit-any` error (which is `error` for src per `@ts-linq/eslint-config`) via inline
disables. This erases type safety in the one place every e2e test depends on. The README also
documents non-existent scripts and misattributes env behaviour.

## Evidence

- `packages/e2e-tests/src/setup.ts:67-68` —
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any` then `let dbProvider: any;`.
- `packages/e2e-tests/src/setup.ts:116-117` — `dropTables(provider: any, tableNames: string[])`
  again disables the rule for an `any` param.
- `packages/eslint-config/index.mjs:54` — `'@typescript-eslint/no-explicit-any': 'error'`
  (so these disables are deliberate escapes from a hard rule).
- `packages/e2e-tests/README.md:31` documents `npm run test:postgresql` — not a real script
  (`package.json:7-13` defines `test:postgres`/`test:mysql`/`test:mssql`).
- `README.md:40-43` documents `SKIP_DB_TESTS` as a package env var, but its handling lives in
  the shared `scripts/jest-db-global-setup.js`, not this package.

## Why this is bad

- The shared helper is the type boundary every e2e test crosses; `any` here propagates
  untyped values into all tests, so a provider API change won't surface as a compile error.
- Inline `eslint-disable` of a hard `error` rule normalises bypassing the rule and hides the
  real cost (no abstraction over the three providers).
- A README that lists non-existent commands misleads contributors and CI authors.

## Why this is bad (catch-block audit)

No catch blocks in scope here (the parser catches are addressed in e2e/task-2).

## Target architecture

Apply **DIP** + accurate docs:

- Introduce a shared provider supertype/interface (the real `DatabaseProvider` contract, or a
  narrow `E2eProvider` port covering `connect`/`disconnect`/`executeQuery`/`executeNonQuery`)
  and type `dbProvider` and `dropTables` against it — removing both `any` escapes.
- Update the README to the real script names and to point env documentation at the shared
  global setup.

## Proposed refactor

1. Define/reuse a typed provider port; type the `switch` result as that union/port.
2. Type `dropTables(provider: E2eProvider, ...)`; drop the `eslint-disable` lines.
3. Rewrite README script list to match `package.json`; relocate/correct the env section.

## Suggested design patterns

- **Dependency Inversion (typed port)** — helpers depend on an interface, not `any`. WHY:
  restores compile-time safety across providers.
- **Documentation-as-contract** — README mirrors real scripts. WHY: trustworthy onboarding.

## Testing plan

- Typecheck (`pnpm typecheck`) passes with the `any` removed.
- Lint passes without the inline `no-explicit-any` disables.
- A doc check (manual or scripted) confirms every README command exists in `package.json`.

## Acceptance criteria

- [ ] No `any` and no `no-explicit-any` disables in `setup.ts`.
- [ ] `dbProvider`/`dropTables` typed against a shared provider port.
- [ ] README lists only real scripts; env section is accurate.

## Refactor order

1. Land the typed port (overlaps with e2e/task-2 + testkits/task-3).
2. Retype setup helpers; remove disables.
3. Fix README.

## Notes

- The typed port is the same one chosen in testkits/task-3; reuse it rather than inventing a
  third interface.
