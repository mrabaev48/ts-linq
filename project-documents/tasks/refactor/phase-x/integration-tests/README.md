# Refactor Audit: integration-tests

## Package responsibility

`@ts-linq/integration-tests` (`packages/integration-tests`) is the centralized
cross-package and cross-dialect integration suite. It contains ~87 `*.test.ts` files under
`tests-new/`, organized into thematic groups (`01-query-provider` … `07-advanced-features`)
plus three dialect directories (`postgres/`, `mysql/`, `mssql/`). It runs via the shared
`createJestConfig` factory with a Docker-Compose global setup/teardown.

## Current architectural problems

- **Per-dialect behavioural duplication with no contract.** The three dialect directories
  re-implement the same expectations (error mapping, isolation, locks, computed, spatial,
  migration-roundtrip) once per backend. See the testkits contract-harness task (`related:`).
- **Two incompatible skip strategies → false greens.** Some files use `if (!url) return;`
  (e.g. `postgres/postgres.integration.test.ts:6`), which makes a test that *never ran*
  report as **passing**. Others use the correct `describe.skip` gate
  (`mysql/errors.integration.test.ts:11-13`). The `return` style hides missing coverage.
- **Massive provider-instantiation boilerplate.** 39 files manually construct a real provider
  and parse the same env vars inline; there is no shared fixture/harness, so connection
  config drifts file-to-file.
- **Empty `try {}` `catch {}` swallows in teardown** (e.g. `mysql/errors.integration.test.ts:44-49`)
  hide cleanup failures, which can cascade into later tests via leftover tables.
- **The `tests-new/` directory name is misleading** and implies a `tests-old/` migration that
  is still referenced in ignore patterns (`jest.config.js:14`) — naming debt.
- **Dead `size-tests/` directory.** `packages/integration-tests/size-tests/tmp` is empty and
  unreferenced by `jest.config.js` or `package.json`.
- **Custom `jest.sequencer.js` is a no-op** (`sort` returns input unchanged) — adds
  indirection without behaviour.

## Refactor goals

- Replace per-dialect duplication with the testkits contract harness.
- Standardise on a single, *loud* skip strategy (`describe.skip` driven by a typed
  capability/availability gate) so unrun tests are visibly skipped, never silently green.
- Extract shared provider fixtures (connect/seed/teardown) to remove boilerplate.
- Make teardown failures observable instead of swallowed.
- Remove dead `size-tests/`, the no-op sequencer, and rename `tests-new/` → `tests/`.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — Eliminate `if (!url) return` false-green skips | P1 | Hidden missing coverage masquerades as passing |
| 2 | task-2.md — Extract shared provider fixture, kill boilerplate | P1 | 39 files repeat connect/env parsing |
| 3 | task-3.md — Fix swallowed teardown catch blocks + isolation | P2 | Leftover tables leak across tests |
| 4 | task-4.md — Remove dead size-tests, no-op sequencer, rename tests-new | P3 | Naming/dead-code debt |

## Dependencies on other packages

- Dev-depends on every runtime package plus `@ts-linq/testkits` and `@ts-linq/jest-config`.
- Behavioural-contract work lands in `@ts-linq/testkits` (see testkits/task-1); this package
  consumes it.
- Global Docker setup lives in repo `scripts/jest-db-global-setup.js` (shared with e2e).

## Testing strategy

- Move shared behavioural assertions into the testkits contract harness; keep only
  dialect-specific cases here.
- Gate DB-dependent suites on a single typed availability check that yields `describe.skip`
  (visible skip), never silent `return`.
- One shared fixture for connect/seed/teardown to enforce consistent isolation.

## Notes

- `jest.config.js:13` raises timeout to 30s — reasonable for containers; flakiness risk is in
  setup health-check (`scripts/jest-db-global-setup.js:147` "tests will run anyway" even when
  services are not healthy), which belongs to the shared script but affects this package.
- Env drift: global setup advertises `POSTGRES_PORT=6543`
  (`scripts/jest-db-global-setup.js:23`) while inline test defaults use `5432`
  (`postgres/postgres.integration.test.ts:9`).
