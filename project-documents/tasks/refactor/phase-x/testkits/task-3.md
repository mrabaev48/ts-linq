---
status: not-started
phase: phase-x
package: testkits
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["testkits/task-1.md", "testkits/task-2.md"]
---

# Refactor: Unify the three competing `DatabaseProvider` interfaces

## Problem

testkits declares the `DatabaseProvider` abstraction **three different ways**: the real one
from `@ts-linq/core` (extended by `TestProvider`), and two narrower, locally-redefined
`DatabaseProvider` interfaces in `MockProvider.ts` and `DatabaseHarness.ts`. There is no
single test-side contract, so mocks and harnesses are not interchangeable with the real
provider and silently model a different shape.

## Evidence

- `packages/testkits/src/TestProvider.ts:2` — `import { DatabaseProvider } from '@ts-linq/core'`
  and `class TestProvider extends DatabaseProvider` (`:151`). This is the *real* contract.
- `packages/testkits/src/mocks/MockProvider.ts:3-10` — a *local* `interface DatabaseProvider`
  with only `connect/disconnect/execute/begin/commit/rollback`.
- `packages/testkits/src/harness/DatabaseHarness.ts:3-10` — a **byte-identical second copy**
  of that local interface.
- `packages/testkits/src/index.ts:8` re-exports `DatabaseProvider` *from the harness file*,
  so the package's public `DatabaseProvider` export is the narrow fake, not the core one.

## Why this is bad

- Consumers importing `DatabaseProvider` from `@ts-linq/testkits` get the narrow 6-method
  interface, which is incompatible with the real provider that `TestProvider` extends — a
  confusing, leaky public surface.
- `execute(sql, params)` in the local interface does not match the real provider's method set
  (`executeQuery`/`executeNonQuery`/`queryEntities`/…), so a `MockDatabaseProvider` can never
  stand in for a real provider in code that uses the real API.
- Duplicated identical interface across two files violates DRY and DIP — there is no single
  abstraction to depend on.

## Target architecture

Apply **Dependency Inversion** with one owned abstraction:

- Define the test-side provider port **once** — ideally reuse the real `DatabaseProvider`
  contract from `@ts-linq/core`/`@ts-linq/types`, or, if a deliberately minimal test port is
  wanted, declare a single `TestDatabasePort` in one module and have both `MockProvider` and
  `DatabaseHarness` import it.
- Export exactly one `DatabaseProvider` symbol from the package barrel, and make it the real
  contract (or clearly-named `TestDatabasePort`), not a shadow copy.

## Proposed refactor

1. Decide: reuse core `DatabaseProvider`, or introduce one `TestDatabasePort` in
   `src/contract/`.
2. Replace both local interface declarations with an import of the single source.
3. Fix `src/index.ts:8` to export the canonical contract (remove the harness-sourced
   `DatabaseProvider` re-export).
4. Align `MockDatabaseProvider.execute` naming with the chosen contract (or document it as a
   distinct narrow port with a distinct name).

## Suggested design patterns

- **Dependency Inversion Principle** — one port, many implementations
  (`TestProvider`, `MockDatabaseProvider`, real providers). WHY: makes fakes substitutable.
- **Adapter** — if the narrow port is kept, `MockDatabaseProvider` adapts it explicitly with
  a non-colliding name. WHY: removes the ambiguous duplicate `DatabaseProvider` export.

## Testing plan

- A type-level test (`tsd` / `expectTypeOf`) asserting `TestProvider` and any mock are
  assignable to the single exported contract.
- Compile-time check that `@ts-linq/testkits` exports exactly one `DatabaseProvider` symbol.

## Acceptance criteria

- [ ] Only one `DatabaseProvider`/`TestDatabasePort` definition exists in testkits.
- [ ] `MockProvider.ts` and `DatabaseHarness.ts` import it; no local re-declarations.
- [ ] `src/index.ts` exports a single, unambiguous provider contract symbol.
- [ ] Type-level test proves fakes are assignable to the contract.

## Refactor order

1. Introduce/choose the single contract.
2. Repoint `MockProvider` and `DatabaseHarness`.
3. Fix barrel export.
4. Add type-level assertion.

## Notes

- Interacts with task-1 (contract harness consumes this port) and task-2 (facade implements
  the real contract).
