# CLAUDE.md — @ts-linq/provider-mysql

## Role

Concrete **MySQL provider**: implements `DatabaseProvider` over the MySQL dialect and a runtime
driver.

## Hard boundaries

- Depends on `core`, `dialect-mysql`, `types`, `metadata`.
- Must **not** be depended on by `core`/dialects. Only consumers, tests, and `testkits` (peer).

## Critical invariants & known hazards

- **`MySqlProvider` is a god class (~578 LOC)** — decompose into connection/execution/mapping
  collaborators (refactor `task-1`, P0).
- **Driver is hard-`require`d** → only real-DB testable. Invert the driver dependency behind a port
  (refactor `task-7`, P0).
- **Transaction isolation hazard:** transactions must run on a *pinned* single connection, not an
  arbitrary pooled connection per statement. A latent unpinned-pool bug was identified — verify the
  transaction path binds one connection for its lifetime.
- `mapRowToEntity` / `coerceToSqlParameter` are triplicated and drifted across providers — extract a
  shared mapper/coercer.
- Error mapping + transient codes are one of three inconsistent copies — unify.

## Public API surface & stability

- `src/index.ts` exports `MySqlProvider` + `buildConnectionString` + spatial codec. Constructor
  config is user-facing.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/provider-mysql/` (2× P0: decompose + invert driver).

## Validation

```bash
pnpm --filter @ts-linq/provider-mysql typecheck
pnpm --filter @ts-linq/provider-mysql lint
pnpm --filter @ts-linq/provider-mysql build
```

Integration/e2e tests need a real MySQL — **never run them in the background** (they hang).

## Do / Don't

- **Do** pin transactions to one connection for their whole lifetime.
- **Do** inject the driver behind a port; share mapping/coercion with sibling providers.
- **Don't** swallow connection/driver failures.
- **Don't** grow `MySqlProvider`.
