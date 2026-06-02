# Refactor Audit: testkits

## Package responsibility

`@ts-linq/testkits` (`packages/testkits`) is the shared test-utility package for the
monorepo. Its `package.json` describes it as *"Contract and integration test utilities"*.
In practice it currently provides:

- `TestProvider` (`src/TestProvider.ts`) — an in-memory fake `DatabaseProvider` backed by a
  `Map`, with a regex-based SQL interpreter. Used by ~31 integration test files and unit
  tests across the monorepo.
- `MockDatabaseProvider` (`src/mocks/MockProvider.ts`) — a record/replay mock provider with
  its own `DatabaseProvider` interface and `expectSql` / `expectParams` assertions.
- `DatabaseHarness` (`src/harness/DatabaseHarness.ts`) — connect/seed/teardown helper that
  redefines *another* `DatabaseProvider` interface. Used by e2e `setup.ts`.
- `EntityBuilder` (`src/builders/EntityBuilder.ts`) — a Test Data Builder, plus inline test
  entity classes (`TestUser`, `TestPost`, `TestComment`) and their fixture builders.
- `TestEntities` (`src/fixtures/TestEntities.ts`) — a *second*, overlapping set of entity
  classes (`User`, `Post`, `Comment`, …) plus sample data arrays.
- `SqlSnapshotMatcher` (`src/snapshot/SqlSnapshotMatcher.ts`) — SQL normalisation + a Jest
  `toMatchSqlSnapshot` matcher.

## Current architectural problems

- **No contract-test harness despite the package's stated purpose.** The package is named
  *"Contract and integration test utilities"* yet contains zero contract-test abstraction.
  Each dialect/provider re-implements identical behavioural expectations by hand in
  `integration-tests` (error mapping, isolation, locks, spatial, computed). This is the
  single largest gap and is cross-cutting (flagged by the dialect & provider clusters).
- **`TestProvider` is a 632-LOC god class** that conflates: an embedded `TestDialect`, a
  storage engine, a hand-rolled regex SQL parser (`SELECT`/`WHERE`/`ORDER BY`/`LIMIT`), a
  batch-statement codec, lifecycle/transaction stubs, and logger plumbing. It silently
  drifts from real provider behaviour and is itself untestable in isolation.
- **Three competing `DatabaseProvider` abstractions.** `@ts-linq/core` exports the real one;
  `MockProvider.ts` and `DatabaseHarness.ts` each declare a *different*, narrower local
  `DatabaseProvider` interface. No single contract.
- **Duplicated entity model.** `EntityBuilder.ts` defines `TestUser/TestPost/TestComment`
  while `TestEntities.ts` defines `User/Post/Comment/...` — two overlapping fixture
  hierarchies with no shared source of truth.
- **`DatabaseHarness` is broken and barely used.** `createSchema` emits
  `CREATE TABLE IF EXISTS` (invalid SQL — should be `IF NOT EXISTS`) and derives table names
  via `entity.name.toLowerCase()`, ignoring real metadata.
- **Stub methods that lie.** `findWhere`/`findWhereIn` ignore their filter and call
  `findAll`; many transaction methods are empty no-ops, so tests that "pass" against
  `TestProvider` exercise no real semantics.

## Refactor goals

- Extract a reusable **Provider/Dialect Contract Test** harness (abstract test suite) that
  every real provider and dialect runs — moving behavioural guarantees out of ad-hoc
  per-dialect integration files into one shared, parameterised suite.
- Decompose `TestProvider` along SRP into a storage engine, a query interpreter, and a thin
  provider facade — or replace it with a real embedded DB (sqlite) where feasible.
- Unify on the single `DatabaseProvider` contract from `@ts-linq/core` / `@ts-linq/types`.
- Consolidate fixtures into one Object-Mother + Test-Data-Builder module.
- Fix or remove `DatabaseHarness`.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Extract provider/dialect Contract Test harness | P1 | Cross-cutting gap; unblocks dialect/provider clusters |
| 2 | task-2.md — Decompose `TestProvider` god class | P1 | 632-LOC untestable hub used by 31+ files |
| 3 | task-3.md — Unify the three `DatabaseProvider` interfaces | P1 | Conflicting contracts hide drift |
| 4 | task-4.md — Consolidate duplicated test fixtures/entities | P2 | Two overlapping entity hierarchies |
| 5 | task-5.md — Fix/remove broken `DatabaseHarness` | P2 | `CREATE TABLE IF EXISTS` bug, name-based DDL |
| 6 | task-6.md — Remove lying stubs / harden `TestProvider` SQL parser | P2 | False-green risk from no-op stubs |

## Dependencies on other packages

- Depends at runtime on `@ts-linq/types`, `@ts-linq/core`, `@ts-linq/metadata`.
- Peer-depends on the three providers (`provider-postgres/mysql/mssql`).
- Consumed by `integration-tests`, `e2e-tests`, and many package-level unit suites.
- The Contract Test harness (task-1) is the natural home for the dialect/provider contract
  work referenced from the dialect and provider cluster audits (`related:`).

## Testing strategy

- The harness *is* the testing strategy: abstract Contract Test suites parameterised by a
  provider/dialect factory, executed once per real backend.
- `TestProvider` decomposition gets focused unit tests per extracted collaborator (storage,
  interpreter) instead of being implicitly tested through downstream suites.
- Fixtures get Object-Mother factories with deterministic defaults to remove `new Date()`
  non-determinism currently embedded in `userBuilder`/`commentBuilder`.

## Notes

- `TestProvider` contains commented-out `console.log` debugging lines
  (`src/TestProvider.ts:453,457,462`) — dead code to remove during decomposition.
- `userBuilder()`/`commentBuilder()` default `createdAt: new Date()`
  (`src/builders/EntityBuilder.ts:71,86`) — non-deterministic fixtures.
