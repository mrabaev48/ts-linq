# CLAUDE.md — @ts-linq/provider-mssql

## Role

Concrete **SQL Server provider**: implements `DatabaseProvider` over the MSSQL dialect and a
runtime driver.

## Hard boundaries

- Depends on `core`, `dialect-mssql`, `types`, `metadata`.
- Must **not** be depended on by `core`/dialects. Only consumers, tests, and `testkits` (peer).

## Critical invariants & known hazards

- **`MssqlProvider` is a god class (~679 LOC)** — the largest provider; decompose into
  connection/execution/mapping collaborators (refactor `task-1`, P0).
- **Driver is hard-`require`d** → only real-DB testable. Invert the driver dependency behind a port
  (refactor `task-7`, P0).
- `mapRowToEntity` / `coerceToSqlParameter` are triplicated and drifted across providers — extract a
  shared mapper/coercer.
- Error mapping + transient error numbers are one of three inconsistent copies — unify.
- T-SQL parameter naming is `@p0…`; ensure batch/SP execution names parameters consistently with the
  dialect's emitters.

## Public API surface & stability

- `src/index.ts` exports `MssqlProvider` + `buildConnectionString` + codecs. Constructor config is
  user-facing.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/provider-mssql/` (2× P0: decompose + invert driver).

## Validation

```bash
pnpm --filter @ts-linq/provider-mssql typecheck
pnpm --filter @ts-linq/provider-mssql lint
pnpm --filter @ts-linq/provider-mssql test
pnpm --filter @ts-linq/provider-mssql build
```

Integration/e2e tests need a real SQL Server — **never run them in the background** (they hang).

## Do / Don't

- **Do** inject the driver behind a port; share mapping/coercion/error-mapping with siblings.
- **Don't** swallow connection/driver failures.
- **Don't** grow `MssqlProvider`.
