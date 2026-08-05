# CLAUDE.md — @ts-linq/dialect-mssql

## Role

SQL Server (T-SQL) **dialect**: SQL/DDL rendering, JSON-path + function translation, temporal
tables, hierarchyid/spatial, batch/SP syntax, introspection. Implements `SqlDialect` +
`sql-visitor` ports.

## Hard boundaries

- Depends on `dialect-kit`, `sql-visitor`, `types` **only**. The `core` and `metadata` edges were
  removed (dialect-postgres/task-8) and are now forbidden by the `no-dialect-to-core`
  dependency-cruiser rule: entity metadata arrives as a `buildSelect` parameter, and the
  introspector takes the narrow `SqlQueryExecutor` port from `@ts-linq/types`.
- Must **not** depend on `provider-mssql` (the provider depends on this dialect).

## Critical invariants & known hazards

- **DDL raw-literal interpolation + unquoted CRUD identifiers are an injection vector** — route all
  identifiers/literals through one quoter (refactor `task-2`, P0). `[ident]` quoting must escape
  embedded `]`.
- Parameter style is `@p0, @p1, …`. Never inline values.
- Upserts use `MERGE` (watch the well-known `MERGE` concurrency/constraint caveats).
- **Computed columns must be excluded from INSERT/UPDATE column lists** — a latent bug surfaced
  here; verify computed-column handling in `MssqlDdlStrategy`/CRUD emit.
- ~85% identical to Postgres/MySQL dialects — prefer fixes in the shared base dialect.

## Public API surface & stability

- `src/index.ts` exports `MssqlDialect` + builders. Consumed by `provider-mssql`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/dialect-mssql/` (1× P0 quoting/identifier fix +
shared-base/capability/contract-test tasks).

## Validation

```bash
pnpm --filter @ts-linq/dialect-mssql typecheck
pnpm --filter @ts-linq/dialect-mssql lint
pnpm --filter @ts-linq/dialect-mssql test
pnpm --filter @ts-linq/dialect-mssql build
```

## Do / Don't

- **Do** quote identifiers (escaping `]`) and parameterize values centrally.
- **Do** exclude computed columns from INSERT/UPDATE.
- **Don't** interpolate raw literals into DDL.
- **Don't** copy-paste cross-dialect logic.
