---
status: not-started
phase: phase-x
package: _shared
priority: P2
effort: S
risk: low
category: testing
depends_on: []
related: ["plugin-audit/task-2.md"]
---

# Refactor: Remove or wire the dead `tests-new/` suites

## Problem

Each plugin ships a second test directory `tests-new/` that the jest configuration never runs, so
~400 lines of tests provide zero protection while looking like coverage.

## Evidence

- `packages/jest-config/index.js:116` — `roots: ['<rootDir>/tests']` (only `tests/` is collected;
  `testMatch: ['**/*.test.ts']` at :117).
- Dead, never-executed files:
  - `packages/plugin-audit/tests-new/AuditPlugin.test.ts` (143 lines)
  - `packages/plugin-multi-tenant/tests-new/MultiTenantPlugin.test.ts` (135 lines)
  - `packages/plugin-soft-delete/tests-new/SoftDeletePlugin.test.ts` (138 lines)
- The active suites live in `tests/` (e.g. `plugin-audit/tests/AuditMiddleware.test.ts`, 414 lines).
- `tests-new/AuditPlugin.test.ts:4` even mocks `@ts-linq/metadata` with a non-existent `__setColumns`
  helper — a different (newer?) testing approach that was never activated.

## Why this is bad

- **False confidence:** the files imply coverage that is never measured or enforced.
- **Drift:** two divergent test styles for the same plugin; the unrun one rots.
- **Clean Code:** dead artifacts should not live in the tree.

## Target architecture

One canonical test directory per package, collected by the shared jest config. Either the `tests-new/`
approach (with mocked metadata) is the intended future and should *replace* `tests/`, or it is
abandoned and should be deleted.

## Proposed refactor

1. Diff `tests-new/` vs `tests/` per plugin; decide which approach is canonical.
2. Either migrate the worthwhile cases into `tests/` and delete `tests-new/`, or promote `tests-new/`
   to `tests/` and remove the old suite.
3. Optionally add a CI guard that fails if a `*.test.ts` exists outside collected roots.

## Suggested design patterns

- N/A (test hygiene).

## Testing plan

- After consolidation, `jest` must collect every committed `*.test.ts`.
- Coverage report shows no orphaned suites.

## Acceptance criteria

- [ ] Exactly one test directory per plugin, all of it executed by jest.
- [ ] `tests-new/` removed (or `tests/` removed if `tests-new/` is promoted).
- [ ] No committed `*.test.ts` lives outside a collected root.

## Refactor order

1. Per-plugin diff/decision. 2. Consolidate. 3. Optional CI guard.

## Notes

Independent of the keep/retire decision only if plugins survive; if retired, files are deleted with
the packages.
