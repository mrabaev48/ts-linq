# Refactor Audit: dialect-mysql

## Package responsibility
`@ts-linq/dialect-mysql` is the MySQL implementation of the `SqlDialect` contract. It generates
SELECT/INSERT/UPDATE/DELETE and bulk/batch SQL with MySQL syntax: `` `backtick` `` identifier quoting,
native `?` positional markers (no renumbering), `LIMIT n OFFSET m` paging (with an offset-only
`LIMIT 18446744073709551615` hack), `LAST_INSERT_ID()`-based generated-key retrieval, and a 65535-parameter
limit. It rejects temporal queries via `TemporalNotSupportedError`. It also provides the DDL strategy
(`mapTypeToMySql`, VIRTUAL/STORED computed columns, inline `COMMENT`), JSON path translation (`->>` operator),
EF-function translations, spatial functions, sequence/HiLo counter-table emulation (`sequenceEmulation.ts`),
DB-first introspection, and a `maxBatchSize` options builder. MySQL uses per-statement batch UPDATE because it
lacks a clean multi-row UPDATE.

## Current architectural problems
- ~85% duplication with MSSQL/Postgres dialects; no shared base (cross-cut: `dialect-postgres/task-1.md`).
- CRUD emits unquoted identifiers; JSON path translator hand-rolls backtick quoting instead of using
  `quoteIdentifier` (task-2).
- Shares all cross-cutting issues: optional-method capability gap, duplicated coerce/emitters
  (WHERE/ORDER byte-identical, JOIN/GROUP near-identical), silent coercion catch, missing contract tests, no
  shared DdlStrategy interface, dead `chunk*Batch` export, duplicated OptionsBuilder, dialect→core/metadata
  coupling (see `dialect-postgres/` host tasks).
- DDL `generateColumnDefinition` appends `COMMENT` inline while MSSQL/PG do not — a copy-paste drift to
  reconcile in the shared DdlStrategy (`dialect-postgres/task-7.md`).
- Offset-without-limit emulation uses a magic `LIMIT 18446744073709551615` constant worth revisiting.

## Refactor goals
- Adopt the shared base dialect + `DialectSyntax`, exposing MySQL specifics (`?` markers, LIMIT/OFFSET hack,
  LAST_INSERT_ID, temporal-not-supported) as hooks/capabilities.
- Quote MySQL identifiers consistently via the centralized quoter.
- Eliminate duplicated coerce/emitter/column-selection logic via the shared kit.

## Recommended task order
| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-2 (CRUD + JSON quoting) | P1 | Correctness on reserved words; centralizes escaping |
| 2 | task-1 (shared base participation) | P1 | Core dedup; MySQL hooks (`?`/limit/returning/temporal) |

Cross-cutting tasks (shared base, capability model, coerce dedup, contract harness, DdlStrategy, dead exports)
are authored in `dialect-postgres/` and apply here. MySQL-specific corrections are tasks 1-2.

## Dependencies on other packages
- `@ts-linq/types` (contract), `@ts-linq/sql-visitor` (JSON/SP/batch helpers, shared-base host candidate),
  `@ts-linq/core` (`SqlHelper`, `DatabaseProvider` — coupling to reduce), `@ts-linq/metadata` (`MetadataStorage`).
- Consumers: `@ts-linq/provider-mysql`, `@ts-linq/migrations`, scaffolding.
- Contract harness in `@ts-linq/testkits`.

## Testing strategy
- Run the shared dialect contract suite (`dialect-postgres/task-6.md`) against `MysqlDialect`.
- Keep `tests-new/dialect/MysqlDialect.test.ts`, `MysqlBatchSyntax.test.ts`, `build-update-concurrency.test.ts`,
  and DDL tests green as regression.
- Add reserved-word / backtick identifier tests and JSON-access tests.

## Notes
MySQL keeps `?` markers while MSSQL/PG renumber — the clearest case for moving parameter rendering into
`DialectSyntax`. MySQL should declare `temporal:false` in the capability model. The per-statement batch UPDATE
and `sequenceEmulation` are genuine MySQL collaborators to keep, not duplicated skeleton.
