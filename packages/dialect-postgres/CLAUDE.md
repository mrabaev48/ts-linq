# CLAUDE.md — @ts-linq/dialect-postgres

## Role

PostgreSQL **SQL dialect**: renders SQL/DDL, translates JSON paths and functions, provides batch/SP
syntax and schema introspection. Implements `SqlDialect` + `sql-visitor` ports.

## Hard boundaries

- Depends on `dialect-kit`, `sql-visitor`, `types` **only**. The `core` and `metadata` edges were
  removed (task-8) and are now forbidden by the `no-dialect-to-core` dependency-cruiser rule:
  entity metadata arrives as a `buildSelect` parameter, and the introspector takes the narrow
  `SqlQueryExecutor` port from `@ts-linq/types` instead of `DatabaseProvider`.
- Must **not** depend on `provider-postgres` — the provider depends on the dialect, not vice versa.
- Postgres specifics live here; nothing Postgres-specific should leak into `sql-visitor`/`core`.

## Critical invariants & known hazards

- **Centralize identifier quoting** — DML and DDL must both route through one `quoteIdentifier`;
  raw interpolation of identifiers/literals is an injection vector (refactor `task-3`, P0).
- Parameter style is `$1, $2, …` (positional, 1-based). Never inline values.
- Upserts use `ON CONFLICT`; CTE-based PK writeback uses explicit type casts. Keep these in
  `batch-syntax.ts`.
- This dialect is ~85% identical to the MySQL/MSSQL dialects — when fixing a bug, check whether the
  shared base dialect (refactor `task-1`) is the right home so the fix applies to all three.

## Capability model

- Optional dialect methods are runtime-sniffed today (`if (!dialect.buildX) throw`). Prefer an
  explicit capability object (refactor `task-7`). Don't add more runtime feature-sniffing.

## Public API surface & stability

- `src/index.ts` exports `PostgresDialect` and supporting builders. Consumed by
  `provider-postgres` and the CLI/migrations.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/dialect-postgres/` (1× P0 quoting + shared-base,
capability-model, and contract-test tasks).

## Validation

```bash
pnpm --filter @ts-linq/dialect-postgres typecheck
pnpm --filter @ts-linq/dialect-postgres lint
pnpm --filter @ts-linq/dialect-postgres test   # __tests__/introspector + json-path-translator
pnpm --filter @ts-linq/dialect-postgres build
```

## Do / Don't

- **Do** route all identifiers/literals through central quoting and parameterize values.
- **Do** keep cross-dialect logic in the shared base, not copy-pasted.
- **Don't** runtime-sniff capabilities; model them explicitly.
- **Don't** leak Postgres syntax into generic packages.
