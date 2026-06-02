---
status: not-started
phase: phase-x
package: testkits
priority: P1
effort: L
risk: medium
category: testing
depends_on: []
related: ["dialect-postgres", "dialect-mysql", "dialect-mssql", "provider-postgres", "provider-mysql", "provider-mssql"]
---

# Refactor: Extract a provider/dialect Contract Test harness into testkits

## Problem

`@ts-linq/testkits` is described as *"Contract and integration test utilities"*
(`packages/testkits/package.json:5`) but ships **no contract-test abstraction**. Every
dialect and provider re-implements the same behavioural expectations by hand, once per
backend, in `packages/integration-tests/tests-new/{postgres,mysql,mssql}/`.

## Evidence

- `packages/testkits/package.json:5` — stated responsibility includes "Contract".
- `packages/integration-tests/tests-new/mysql/errors.integration.test.ts:14-50` and the
  matching `postgres/errors.integration.test.ts` / `mssql/errors.integration.test.ts`
  each manually re-assert UNIQUE → `UniqueConstraintError`, FK → `ForeignKeyConstraintError`
  with copy-pasted setup/teardown.
- The pattern repeats for `*.locks.integration.test.ts`, `*.isolation.integration.test.ts`,
  `*.computed.integration.test.ts`, `*.spatial.integration.test.ts`,
  `*.migration-roundtrip.integration.test.ts` across all three dialect directories.
- 39 integration test files instantiate a real provider directly (grep: `PostgresProvider|
  MySqlProvider|MssqlProvider` across `tests-new`), each repeating env-parsing and connect
  boilerplate (`postgres.integration.test.ts:6-13`).
- `grep -i contract` across the test packages matches only `testkits/package.json` — i.e.
  no implementation exists.

## Why this is bad

- Behavioural guarantees that *should* be identical across dialects are defined three times,
  diverge silently, and give no single answer to "what does a provider promise?".
- Adding a new dialect requires copying N test files instead of registering one factory.
- Violates DRY and the Open/Closed Principle: extending coverage means editing many files.
- There is no executable specification of the provider contract — drift (e.g. `TestProvider`
  diverging from real providers) goes undetected.

## Target architecture

Apply **Clean Architecture** (the contract is a boundary abstraction; concrete providers are
plug-in adapters) and the **Contract Test (abstract test) pattern**:

- A `defineProviderContract(factory)` / `defineDialectContract(factory)` exported from
  `testkits/src/contract/`. Each is a parameterised abstract Jest suite that receives a
  factory producing a configured provider/dialect plus a capability descriptor (does this
  backend support spatial? JSON? savepoints?).
- Capability gating via a typed `Capabilities` object (dependency inversion: the suite asks
  the adapter what it supports rather than hard-coding per-dialect `describe.skip`).
- Each provider/dialect package (or `integration-tests`) calls the factory once:
  `defineProviderContract(() => new PostgresProvider(cfg), pgCapabilities)`.

This follows **composition-first**: the suite composes behaviours; backends compose in via a
factory. **DI**: the suite depends on the abstract factory, not concrete providers.

## Proposed refactor

1. Create `packages/testkits/src/contract/ProviderContract.ts` exporting
   `defineProviderContract(name, factory, capabilities)`.
2. Create `packages/testkits/src/contract/DialectContract.ts` for SQL-shape guarantees that
   can run without a live DB (uses `SqlSnapshotMatcher`).
3. Define a `Capabilities` interface (`spatial`, `json`, `savepoints`, `returning`,
   `temporal`, `computed`, `hierarchy`).
4. Move the *shared* assertions out of the per-dialect integration files into the contract
   suites; leave only genuinely dialect-specific cases inline.
5. Have the three dialect-integration directories invoke the contract factories.

## Suggested design patterns

- **Contract Test / Abstract Test** — one executable spec, many backends. WHY: removes
  triplicated behavioural assertions and detects drift.
- **Factory** — `factory: () => Provider`. WHY: lets the abstract suite stay backend-agnostic
  and supports per-run config without inheritance.
- **Capability descriptor (Strategy-ish)** — WHY: replaces scattered `describe.skip` env
  checks with a single typed gate, improving discoverability.
- **Adapter** — each provider already conforms to the core `DatabaseProvider` contract; the
  harness treats it as the port.

## Testing plan

- The harness is self-verifying: run it against `TestProvider` (a known fake) to prove the
  suite shape, then against each real provider behind `RUN_DB_TESTS`.
- Add a meta-test asserting that every dialect package registers the contract suite (guards
  against a new dialect skipping it).

## Acceptance criteria

- [ ] `defineProviderContract` and `defineDialectContract` exported from `@ts-linq/testkits`.
- [ ] A typed `Capabilities` descriptor gates optional features (no raw `describe.skip` env
      checks left for shared behaviours).
- [ ] At least error-mapping, isolation, and locks behaviours are expressed once in the
      contract and consumed by all three dialect directories.
- [ ] Per-dialect integration files contain only backend-specific cases.
- [ ] Harness runs green against `TestProvider` and against each real provider in CI.

## Refactor order

1. Define `Capabilities` + factory types.
2. Build `ProviderContract` from the `errors` suite (smallest, clearest duplication).
3. Migrate `isolation` and `locks`.
4. Wire dialect packages; delete now-empty duplicate assertions.

## Notes

- This task is the home for the contract-test need referenced by the dialect and provider
  cluster audits. Coordinate via `related:`.
