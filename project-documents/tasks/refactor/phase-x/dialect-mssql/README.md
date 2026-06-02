# Refactor Audit: dialect-mssql

## Package responsibility
`@ts-linq/dialect-mssql` is the SQL Server implementation of the `SqlDialect` contract. It generates
SELECT/INSERT/UPDATE/DELETE and bulk/batch SQL with SQL Server syntax: `[bracket]` identifier quoting, `@pN`
parameter markers, `TOP (n)` / `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY` paging, `OUTPUT INSERTED` for
generated-key writeback, and a 2100-parameter limit. It also provides the DDL strategy (`mapTypeToMssql`,
PERSISTED computed columns, `sp_addextendedproperty` comments), temporal-table clauses (`emit-temporal.ts`),
hierarchyid functions, JSON path translation (`JSON_VALUE`), EF-function translations, spatial functions,
DB-first introspection, and a `maxBatchSize` options builder.

## Current architectural problems
- ~85% duplication with MySQL/Postgres dialects; no shared base (cross-cut: `dialect-postgres/task-1.md`).
- DDL interpolates raw table names into string literals without escaping single quotes, and CRUD emits
  unquoted identifiers — the worst instance of the cluster quoting defect (task-2, P0).
- INSERT/batch column filter omits the `isComputed` exclusion that PG/MySQL have, risking INSERTs into
  computed columns (task-3 — a concrete correctness bug).
- MSSQL provider calls optional dialect methods without the guards PG/MySQL use, yielding opaque `TypeError`s
  (task-4); root cause is the optional-method design (capability model, `dialect-postgres/task-2.md`).
- Shares all cross-cutting issues: optional-method capability gap, duplicated coerce/emitters, silent coercion
  catch, missing contract tests, no shared DdlStrategy interface, dead `chunk*Batch` export, duplicated
  OptionsBuilder, dialect→core/metadata coupling (see `dialect-postgres/` host tasks).

## Refactor goals
- Adopt the shared base dialect + `DialectSyntax`, exposing MSSQL specifics (TOP, OFFSET-FETCH, OUTPUT, temporal)
  as hooks.
- Make MSSQL SQL-injection-safe and consistent in identifier quoting.
- Eliminate the computed-column INSERT divergence via the shared column-selection policy.
- Uniform, descriptive provider failure mode via the capability model.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-2 (DDL literal escaping + CRUD quoting) | P0 | Only safety/correctness defect; MSSQL worst-affected |
| 2 | task-3 (computed-column filter parity) | P1 | Concrete correctness bug; lands with shared column policy |
| 3 | task-4 (provider guard / capability) | P2 | Consistent failure mode; superseded by capability model |
| 4 | task-1 (shared base participation) | P1 | Core dedup; MSSQL hooks (TOP/OFFSET/OUTPUT/temporal) migrated last |

Cross-cutting tasks (shared base, capability model, coerce dedup, contract harness, DdlStrategy, dead exports)
are authored in `dialect-postgres/` and apply here.

## Dependencies on other packages
- `@ts-linq/types` (contract), `@ts-linq/sql-visitor` (JSON/SP/batch helpers, shared-base host candidate),
  `@ts-linq/core` (`SqlHelper`, `DatabaseProvider` — coupling to reduce), `@ts-linq/metadata` (`MetadataStorage`).
- Consumers: `@ts-linq/provider-mssql`, `@ts-linq/migrations`, scaffolding.
- Contract harness in `@ts-linq/testkits`.

## Testing strategy
- Run the shared dialect contract suite (`dialect-postgres/task-6.md`) against `MssqlDialect`.
- Keep `tests-new/dialect/MssqlDialect.test.ts`, `MssqlBatchSyntax.test.ts`, `build-update-concurrency.test.ts`,
  and temporal/DDL tests green as regression.
- Add adversarial-identifier (single quote, `]`) tests and computed-column INSERT/UPDATE tests.

## Notes
MSSQL is the only dialect supporting temporal queries; it should declare `temporal:true` in the capability
model. Its `OUTPUT INSERTED ... AS id` returning strategy and 2100-parameter limit are genuine deltas to keep
as per-dialect hooks/data, not duplicated skeleton.
