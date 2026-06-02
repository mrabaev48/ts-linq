# CLAUDE.md — @ts-linq/provider-postgres

## Role

Concrete **PostgreSQL provider**: implements `DatabaseProvider` over the Postgres dialect and a
runtime driver. Top of the runtime graph alongside `orm`.

## Hard boundaries

- Depends on `core`, `dialect-postgres`, `types`, `metadata`.
- Must **not** be depended on by `core`/dialects. Only `orm` consumers, tests, and `testkits`
  (peer) reference it.

## Critical invariants & known hazards

- **`PostgresProvider` is a god class (~532 LOC)** — decompose into connection/execution/mapping
  collaborators (refactor `task-1`, P0).
- **Driver is hard-`require`d**, so the provider can only be tested against a real DB. Invert the
  driver dependency (DI/port) so it can be unit-tested with a fake (refactor `task-7`, P0).
- **There is a broken import behind a silent catch** (a `MetricsSafe` import) that fails quietly —
  fix the import and stop swallowing (refactor `task-7`, P0).
- `mapRowToEntity` / `coerceToSqlParameter` are **triplicated** across the three providers and have
  already drifted. Extract a shared mapper/coercer (refactor `task-2`/`task-4`).
- Error mapping + `transientErrorCodes` are one of three inconsistent copies — unify behind a
  shared error registry.

## Public API surface & stability

- `src/index.ts` exports `PostgresProvider` + `buildConnectionString` + codecs. The constructor
  config shape is user-facing.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/provider-postgres/` (2× P0: decompose + invert driver).

## Validation

```bash
pnpm --filter @ts-linq/provider-postgres typecheck
pnpm --filter @ts-linq/provider-postgres lint
pnpm --filter @ts-linq/provider-postgres test
pnpm --filter @ts-linq/provider-postgres build
```

Integration/e2e tests need a real Postgres — **never run them in the background** (they hang).

## Do / Don't

- **Do** inject the driver behind a port so the provider is unit-testable.
- **Do** share row-mapping/coercion/error-mapping with the other providers.
- **Don't** swallow import/connection failures.
- **Don't** grow `PostgresProvider`.
