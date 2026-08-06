---
status: not-started
phase: phase-x
package: migrations
priority: P3
effort: S
risk: low
category: correctness
depends_on: []
related: ['dialect-postgres/task-10.md']
---

# Bug: a plain `ADD COLUMN` drops the column comment

## Problem

Whether a newly added column keeps its `comment` depends on an unrelated property. If the column is
computed **or** carries a `defaultExpression`, `ALTER TABLE … ADD COLUMN` renders the full column
definition and the MySQL inline `COMMENT '…'` survives. A plain column — no computed expression, no
default expression — takes the other branch and the comment is dropped. `CREATE TABLE` emits it in
both cases, so the same column is documented or not depending only on how it entered the schema.

## Evidence

- `packages/migrations/src/builders/handlers/ColumnHandlers.ts` — `handleAddColumnChange`:
  ```ts
  const rendersFullColumnDef = isComputedColumn(ch.column) || hasDefaultExpression(ch.column);
  const column = toColumnMetadata(dialect, ch.column);
  if (!rendersFullColumnDef) column.comment = undefined;
  ```
  The strip is deliberate and commented — `dialect-postgres/task-10` preserved the historical
  behaviour byte-for-byte rather than changing output in a refactor PR.
- `packages/migrations/tests-new/builders/ddl-convergence.golden.test.ts` — the golden pins it: the
  fixture's `orders.note` column declares `comment: 'free-form note'` and the MySQL statement is
  `` ALTER TABLE `orders` ADD COLUMN `note` TEXT `` with no `COMMENT`.
- `packages/dialect-mysql/src/MySqlDdlStrategy.ts` — `renderScalarColumn` appends
  `COMMENT <literal>` whenever `column.comment` is set, i.e. the strategy is already correct; only
  the migrations call site removes the field.

## Why this is bad

- Column documentation silently disappears for the common case (a plain new column), which is the
  case most likely to need it.
- The rule is invisible to the adapter and the strategy — it lives at one call site, so any new
  ADD COLUMN caller has to rediscover it. `handleAlterColumnChange`, two functions below, calls
  `generateAddColumnSql` *without* stripping, so the two paths already differ by convention rather
  than by a named concept.

## Target architecture

Delete the strip; let `generateAddColumnSql` render the column definition the same way everywhere.
The only currently affected dialect is MySQL (PostgreSQL and SQL Server emit comments as separate
statements, which migrations does not emit at all — see the note below).

## Proposed refactor

1. Remove the `if (!rendersFullColumnDef) column.comment = undefined;` line and the now-unused
   `rendersFullColumnDef` local.
2. Update the golden: MySQL `ADD COLUMN` statements for commented columns gain `COMMENT '…'`.
3. Document the output change in the PR — it is additive, but it *is* a change to emitted DDL.

## Testing plan

- **Regression:** golden diff limited to MySQL `ADD COLUMN` lines for columns with a comment.
- **Unit:** a commented column produces identical SQL whether it is computed, has a default
  expression, or neither.

## Acceptance criteria

- [ ] `ADD COLUMN` carries the column comment regardless of computed/default-expression status.
- [ ] No comment-stripping special case remains in `ColumnHandlers`.
- [ ] Golden updated; the diff is additive and documented.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm build`, `arch:*` pass.

## Notes

Related but larger: migrations never emits **standalone** comment statements at all, so PostgreSQL
`COMMENT ON COLUMN …` and SQL Server `sp_addextendedproperty` comments are lost on every path, not
just this one. `AbstractDdlStrategy.generateCommentSql` already produces them. Wiring that in is an
output change on all three dialects and belongs in its own task — file it if this one confirms the
appetite.
