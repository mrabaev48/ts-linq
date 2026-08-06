---
status: not-started
phase: phase-x
package: migrations
priority: P2
effort: L
risk: medium
category: package-boundary
depends_on: ['task-9.md', 'dialect-postgres/task-10.md']
related: ['dialect-postgres/task-7.md', 'dialect-postgres/task-12.md']
---

# Refactor: finish the DDL convergence — CREATE TABLE wrapper, foreign keys, indexes, RENAME

## Problem

`dialect-postgres/task-10` moved column definitions, `PRIMARY KEY`, UNIQUE add/drop and the
ADD/DROP/ALTER COLUMN statements onto the shared `DdlStrategy`, byte-for-byte. Four emitters stayed
behind because the shared contract cannot express them without changing the SQL every existing
migration emits. Each is a genuine gap in the contract, not a migrations quirk:

| Still local | Why it could not converge |
|---|---|
| CREATE TABLE wrapper | Migrations guards with `IF OBJECT_ID(N'…', N'U') IS NULL`; `MssqlDdlStrategy.wrapCreateTable` uses `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = …)`. Different text **and** different semantics — `OBJECT_ID` resolves against the default schema, `sys.tables` matches the name in any schema. MySQL would additionally gain `COMMENT='…'`. |
| Foreign keys (inline + `ALTER`) | `ForeignKeySpec` in `@ts-linq/types` is single-column (`columnName`/`relatedColumnName`); migrations supports composite keys, and the strategy has no inline-FK hook for CREATE TABLE at all. |
| Indexes | `PgIndexBuilder` emits `IF NOT EXISTS` and has no PG `INCLUDE`; `IndexHandlers` is the inverse. Neither is a superset. |
| `RENAME TABLE` | MySQL migrations emits `RENAME TABLE a TO b`; the `AbstractDdlStrategy` base emits `ALTER TABLE a RENAME TO b` (MySQL accepts both, but the bytes differ). |

## Evidence

- `packages/migrations/src/builders/handlers/TableHandlers.ts:77-90` — the local CREATE TABLE
  wrapper and inline-FK assembly, with the reason documented in the docblock.
- `packages/migrations/src/builders/handlers/ForeignKeyHandlers.ts:46-63` — `buildInlineFkSql` takes
  `columns: string[]` / `refColumns: string[]`.
- `packages/types/src/dialect.ts` — `ForeignKeySpec` is single-column; `CreateIndexSpec` is
  `{ name, columns, unique }` only.
- `packages/dialect-postgres/src/builders/PgIndexBuilder.ts` vs
  `packages/migrations/src/builders/handlers/IndexHandlers.ts:59+` — the divergent index feature sets.
- `project-documents/tasks/refactor/phase-x/dialect-postgres/README.md` — the "Migrations↔dialect
  convergence (task-10)" section lists these as the deliberate remainder.

## Why this is bad

- Every one of these is still a *second* implementation of something a dialect package already owns,
  so the drift risk `dialect-postgres/task-7` and `task-10` set out to remove persists in four
  places — including identifier quoting, which now runs through two escapers within a single
  generated `CREATE TABLE` statement (columns and PK via the dialect's `quoteIdentifier`, table name
  and inline FKs via the migrations `SqlQuoter`). They agree today; nothing enforces that.
- Composite foreign keys are unrepresentable in the shared contract, so any consumer of
  `DdlStrategy` (providers, `EnsureCreated`, scaffolding) silently cannot express them.

## Target architecture

Widen the contract where the gap is real, then converge:

1. **`ForeignKeySpec` → composite** (`columnNames: string[]` / `relatedColumnNames: string[]`), plus
   an inline-FK rendering hook so `generateCreateTableSql` can accept table-level FK clauses. This
   is a **breaking** change to `@ts-linq/types` (`major`) — plan the migration for the three
   dialects and `AbstractDdlStrategy.generateForeignKeySql`.
2. **CREATE TABLE wrapper** — decide one existence guard per dialect and reconcile. The MSSQL choice
   is a semantic decision (schema-scoped `OBJECT_ID` vs name-only `sys.tables`), not a formatting
   one: pick deliberately and document it.
3. **Indexes** — reconcile `CreateIndexSpec` with the union of what both sides support (`IF NOT
   EXISTS`, PG `INCLUDE`, `using`, `concurrently`, `withParams`, `mysqlVisibility`, ordering,
   collations, nulls, expressions), then delete `IndexHandlers`' emitter. Do `task-9` first so
   migrations has a single index path to converge.
4. **`RENAME TABLE`** — override `generateRenameTableSql` in `MySqlDdlStrategy` (or align migrations)
   and update whichever golden moves.

## Testing plan

- Snapshot the migration DDL before/after and **reconcile every difference explicitly** — unlike
  `task-10`, this task cannot be byte-identical, so each changed statement needs a stated reason.
- `runDdlStrategyContract` (`@ts-linq/testkits`) must stay green; extend it for composite FKs and the
  widened index spec.
- Integration: composite FK, partial/GIN/`INCLUDE` index, and re-running a migration against an
  existing table (the existence guard) on all three containers.

## Acceptance criteria

- [ ] `ForeignKeySpec` supports composite keys; migrations no longer builds FK SQL locally.
- [ ] One CREATE TABLE wrapper per dialect, with the MSSQL guard semantics documented.
- [ ] One index emitter; `IndexHandlers`' `buildCreateIndexSql` is gone or a thin adapter.
- [ ] `RENAME TABLE` comes from the strategy on all three dialects.
- [ ] Every DDL output change is listed with its reason in the PR.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`,
      `pnpm build`, `arch:*` pass.

## Notes

Pairs with `dialect-postgres/task-12` (inject the quoter into `AbstractDdlStrategy`): once the
wrapper and FKs move to the strategy, the dual-escaper situation inside one statement disappears on
its own. Sequencing them together is likely cheaper than doing either alone.
