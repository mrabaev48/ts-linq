# CLAUDE.md — @ts-linq/dialect-mysql

## Role

MySQL **SQL dialect**: SQL/DDL rendering, JSON-path + function translation, batch/SP syntax,
sequence emulation, and introspection. Implements `SqlDialect` + `sql-visitor` ports.

## Hard boundaries

- Depends on `dialect-kit`, `sql-visitor`, `types` **only**. The `core` and `metadata` edges were
  removed (dialect-postgres/task-8) and are now forbidden by the `no-dialect-to-core`
  dependency-cruiser rule: entity metadata arrives as a `buildSelect` parameter, and the
  introspector takes the narrow `SqlQueryExecutor` port from `@ts-linq/types`.
- Must **not** depend on `provider-mysql` (the provider depends on this dialect).

## Critical invariants & known hazards

- Parameter style is positional `?`. Identifiers are backtick-quoted — route through one quoter,
  never interpolate raw.
- MySQL has **no native sequences**: `sequenceEmulation.ts` uses a counter table. Keep HiLo/
  sequence semantics consistent with `orm`'s value generators.
- Upserts use `ON DUPLICATE KEY UPDATE`; PK writeback relies on `LAST_INSERT_ID`. Multi-row batch
  insert PK writeback is fragile — verify behavior when changing `batch-syntax.ts`.
- ~85% identical to the Postgres/MSSQL dialects — prefer fixes in the shared base dialect so all
  three benefit.

## Capability model

- Don't add runtime feature-sniffing (`if (!dialect.buildX)`); model optional features as explicit
  capabilities (shared dialect refactor).

## Public API surface & stability

- `src/index.ts` exports `MysqlDialect` + builders. Consumed by `provider-mysql`.

## Known issues / refactor tasks

See `project-documents/tasks/refactor/phase-x/dialect-mysql/` (shared-base extraction, central
quoting, contract tests).

## Validation

```bash
pnpm --filter @ts-linq/dialect-mysql typecheck
pnpm --filter @ts-linq/dialect-mysql lint
pnpm --filter @ts-linq/dialect-mysql test
pnpm --filter @ts-linq/dialect-mysql build
```

## Do / Don't

- **Do** parameterize values and quote identifiers centrally.
- **Do** keep sequence emulation consistent with `orm` value generators.
- **Don't** copy-paste logic shared with the other dialects.
- **Don't** runtime-sniff capabilities.
