---
status: not-started
phase: phase-x
package: migrations
priority: P1
effort: S
risk: low
category: correctness
depends_on: []
related: ['dialect-postgres/task-10.md']
---

# Bug: indexes on a newly created table lose nine of their declared options

## Problem

There are two `CREATE INDEX` emitters in `@ts-linq/migrations` and they are not equivalent. An index
that arrives on an **existing** table (`TableDiff.indexCreates`) is rendered by the full
`buildCreateIndexSql`; the same index arriving with a **new** table (`TableSnapshot.indexes`) goes
through a hand-rolled four-field loop inside `handleCreateTable` that silently discards everything
else the model declared.

Dropped on the fresh-table path: `orders`, `collations`, `nulls`, `expressions`, `using`,
`concurrently`, `withParams`, `mysqlVisibility`, `include` — nine of the thirteen `IndexDef` fields.

## Evidence

- `packages/migrations/src/builders/handlers/TableHandlers.ts:43-52` — the hand-rolled loop; it reads
  only `unique`, `columns`, `name`, `where` (and suppresses `where` on MySQL).
- `packages/migrations/src/builders/handlers/IndexHandlers.ts:59+` (`buildCreateIndexSql`) — the full
  emitter, reached from `handleIndexCreates` (`IndexHandlers.ts:26`).
- `packages/migrations/src/DiffTypes.ts:14-28` — `IndexDef` declares all thirteen fields.
- Consequence: a GIN index declared on a new table emits a plain btree
  `CREATE INDEX "ix" ON "t" ("tags")`, while the identical declaration added to an existing table
  emits `CREATE INDEX "ix" ON "t" USING GIN ("tags")`. Same model, different schema, depending only
  on whether the table already existed.

## Why this is bad

- A silently degraded index is a performance bug that surfaces far from its cause, and only in the
  environment where the table happened to be created fresh (typically production, not the dev DB
  that grew incrementally).
- It is a third live `CREATE INDEX` emitter after `dialect-postgres/task-10` consolidated the column
  /PK/UNIQUE emitters — the last hand-rolled DDL in that file.

## Target architecture

One index emitter for both paths. `handleCreateTable` already has the `DdlStrategy` in scope
(`dialect-postgres/task-10`), so there are two candidate homes:

- **Reuse the package-local `buildCreateIndexSql`** — smallest change, keeps the migrations index
  feature set (which is richer than the dialect builders' on some fields), fixes the asymmetry
  immediately.
- **Route through `ddl.generateCreateIndexSql`** — the deeper fix, but the dialect index builders and
  `IndexHandlers` currently diverge (`PgIndexBuilder` emits `IF NOT EXISTS` and has no PG `INCLUDE`;
  `IndexHandlers` is the inverse), so this cannot be done without reconciling them.

Prefer the first for this task and leave the second to the index half of `migrations/task-11`.

## Proposed refactor

1. Replace the inline loop in `handleCreateTable` with `buildCreateIndexSql(dialect, td.create.name, idx)`.
2. Confirm the output for a plain index (name/columns/unique/where only) is byte-identical to the
   loop it replaces — if it is, the change is invisible for simple indexes and only *adds* the
   previously-dropped options.
3. Extend the `ddl-convergence-fixture` fresh-table snapshot with an index carrying `using`,
   `include`, `orders` and `nulls`, and update the golden.

## Testing plan

- **Regression:** golden diff should show additions only, on the fresh-table statements.
- **Parity:** a unit test asserting that the same `IndexDef` yields identical SQL whether it arrives
  via `TableSnapshot.indexes` or `TableDiff.indexCreates` — this is the invariant that was violated.
- **Integration:** create a table with a GIN/`INCLUDE`/partial index through a migration and assert
  via introspection that the options landed.

## Acceptance criteria

- [ ] The fresh-table and existing-table index paths emit identical SQL for identical `IndexDef`s.
- [ ] No hand-rolled `CREATE INDEX` string remains in `TableHandlers.ts`.
- [ ] Golden updated; the diff is additive and documented.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`,
      `arch:*` pass.

## Notes

Pre-existing; surfaced by the `dialect-postgres/task-10` review, which was scoped to byte-preserving
convergence and so could not fix it.
