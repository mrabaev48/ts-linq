# Refactor Audit: e2e-tests

## Package responsibility

`@ts-linq/e2e-tests` (`packages/e2e-tests`) runs full-stack end-to-end scenarios of the ORM
against real databases (Postgres/MySQL/MSSQL). It contains 19 `*.e2e.test.ts` files grouped
by feature (`crud/`, `queries/`, `transactions/`, `migrations/`, `pooling/`), a shared
`src/setup.ts` providing provider setup/teardown helpers, and a local AST transformer copy.

## Current architectural problems

- **Duplicated AST transformer adapter.** `packages/e2e-tests/src/jest-transformer.js` is a
  near-verbatim copy of `packages/jest-config/jest-transformer.js`; only the relative
  `require` path differs. Two copies of compiler-critical glue drift independently.
- **Provider-name inconsistency across three layers.** `setup.ts` uses the literal
  `'postgresql'`; `package.json` scripts use `test:postgres` with
  `--testNamePattern=postgres`; the README documents `npm run test:postgresql` (a script that
  does not exist). The names do not line up.
- **Bespoke `parse*Url` connection parsing** in `setup.ts` duplicates what the integration
  global setup already encodes, and uses different defaults (port 5432 vs the global setup's
  6543), so e2e and integration can target different databases.
- **`any`-typed provider plumbing.** `setup.ts` declares `let dbProvider: any` and an
  `any`-typed `dropTables(provider: any, ...)`, defeating type safety in the shared helper.
- **Same silent-skip risk as integration** — e2e relies on env presence for DB tests; needs
  the same visible `describe.skip` gate (see e2e/task-2).
- **README drift.** Documents non-existent scripts and an env var (`SKIP_DB_TESTS`) whose
  handling lives in the shared global setup, not this package.

## Refactor goals

- Eliminate the duplicated transformer adapter (single shared module).
- Unify provider naming and connection config with integration-tests + testkits.
- Remove `any` from the shared setup helpers.
- Apply the visible skip gate.
- Correct the README to match real scripts/behaviour.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md — De-duplicate the AST transformer adapter | P1 | Compiler-critical glue copied; drift risk |
| 2 | task-2.md — Unify provider naming + connection config + skip gate | P1 | 3-way name mismatch; silent-skip risk |
| 3 | task-3.md — Remove `any` from setup helpers; fix README drift | P2 | Type-safety + doc accuracy |

## Dependencies on other packages

- Depends on every runtime provider/dialect plus `@ts-linq/testkits` and
  `@ts-linq/jest-config`.
- Shares `scripts/jest-db-global-setup.js` / teardown with integration-tests.
- The transformer adapter belongs in `@ts-linq/jest-config` (or a shared module) — see
  jest-config audit.

## Testing strategy

- E2E remains scenario-based, but should consume the shared connection config + visible skip
  gate so a no-DB run reports skipped, not passed.
- The AST transformer adapter should be imported from one place and covered by a single
  smoke test that proves `.where(lambda)` rewriting applies in e2e.

## Notes

- `package.json:11` `test:docker` references `docker-compose.test.yml`; `:12`
  `test:docker-compose` references `docker-compose.e2e.yml` — two compose files; verify both
  exist and are intended.
- `setup.ts:67,116` carry `eslint-disable @typescript-eslint/no-explicit-any` — the rule is
  `error` in src per eslint-config, so these are deliberate escapes worth removing.
