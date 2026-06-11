---
status: completed
phase: phase-x
package: query
priority: P0
effort: M
risk: high
category: sql
depends_on: []
related: ["query/task-1.md"]
---

# Refactor: Move raw SQL string assembly out of `Queryable` into the dialect layer

## Problem
`Queryable` builds raw SQL fragments by hand — including **hardcoded ANSI double-quote
identifier quoting** and **unquoted, unresolved property names** — bypassing the dialect's
`quoteIdentifier`. This is both a portability bug (MySQL uses backticks) and a
package-boundary violation (the generic query package should not know SQL dialect syntax).

### Sites
- `ofType` (TPH/TPT/TPC) emits raw SQL with hardcoded `"`:
  - TPH discriminator: `condition: \`"${discriminator.columnName}" = ?\`` (`Queryable.ts:885`).
  - TPT join: `on: \`"${baseTable}"."${pk}" = "${subTable}"."${pk}"\`` (`Queryable.ts:897`).
- `_addJoinOn` builds the `ON` clause with **unquoted** identifiers and raw
  table.column concatenation: `on: \`${leftMeta.tableName}.${leftCol} = ...\``
  (`Queryable.ts:1714`).
- `whereInSubquery` interpolates the **raw property key** (not resolved to a column name and
  not quoted) directly into SQL: `condition: \`${column} IN (${query})\`` (`Queryable.ts:700`).
- `whereExists`: `condition: \`EXISTS (${query})\`` — the subquery SQL is spliced in
  (`Queryable.ts:684`); acceptable but the subquery itself was built by another
  `QueryBuilder` so param ordering across the splice must be audited.

## Evidence
- `grep -n 'IN (\|EXISTS\|"\\${' packages/query/src/Queryable.ts` → lines 504, 684, 700,
  885, 897.
- Postgres dialect provides `quoteIdentifier` (`packages/dialect-postgres/src/PostgresDialect.ts:49`)
  and re-numbers `?`→`$N`; the hand-built `"..."` fragments in `Queryable` are *not* routed
  through it, so a MySQL provider would receive ANSI quotes.

## Why this is bad
- **Cross-dialect correctness**: hardcoded `"` breaks on MySQL/MariaDB (backtick) and any
  dialect with non-ANSI quoting.
- **Package-boundary violation**: `@ts-linq/query` is dialect-agnostic by design (it depends
  on `SqlDialect` abstractly via the provider) yet embeds SQL syntax.
- **Injection-surface / unresolved columns**: `whereInSubquery` puts the caller's property
  key straight into SQL without column-name resolution or quoting — at minimum a correctness
  bug (wrong column when `@Column({name})` is used), and a fragile pattern.

## Target architecture
All identifier quoting and clause-shape assembly belongs to the **dialect** (Clean
Architecture: SQL-syntax concerns are the outermost adapter, the query DSL is inner). The
query package should emit **structured clauses** (e.g. `JoinClause`, discriminator
predicate descriptors) and let `SqlDialect` render them.

- `ofType` → produce structured `WhereClause`/`JoinClause`/`from` overrides; dialect renders
  with `quoteIdentifier`.
- `_addJoinOn` → push a structured `JoinClause { type, table, leftCol, rightCol, alias }`;
  dialect builds the `ON` with proper quoting (the model already carries `joins`).
- `whereInSubquery` → resolve `column` via `resolveColumnName` + `quoteIdentifier` before
  emission, or model it as a structured `inSubquery` clause.

## Proposed refactor
1. Extend the `JoinClause`/where model (in `@ts-linq/types`) to carry *structured* column
   references instead of pre-rendered `ON` strings where feasible.
2. Move quoting into dialect `buildSelect`/join rendering; delete the inline `"..."`.
3. Fix `whereInSubquery` to resolve + quote the column (immediate correctness fix even
   before full structuring).
4. Audit param ordering for the `whereExists`/`whereInSubquery` SQL splice (the spliced
   subquery's params are pushed after the outer clause — verify `?`→`$N` renumbering by the
   dialect still aligns).

## Suggested design patterns
- **Strategy** (`SqlDialect`) owns quoting/rendering — *Why*: one extension point per
  dialect; query package stays syntax-free.
- **Builder** emitting structured clauses — *Why*: separates *what* to query from *how* to
  render it (Clean Architecture boundary).

## Testing plan
- **Contract**: render `ofType`/join/`whereInSubquery` against each dialect and assert
  correct quoting (`"` for PG/MSSQL, backtick for MySQL).
- **Regression**: existing of-type / join tests green across dialects.
- **Unit**: param-ordering test for the subquery splice.

## Acceptance criteria
- [ ] No hardcoded `"`-quoted identifiers remain in `Queryable.ts`.
- [ ] `_addJoinOn` and `ofType` emit structured clauses rendered by the dialect.
- [ ] `whereInSubquery` resolves + quotes the column.
- [ ] Cross-dialect quoting verified by contract tests.
- [ ] Subquery param ordering covered by a test.

## Refactor order
Pairs with `query/task-1.md` (JoinBuilder/InheritanceQueryPlanner extraction). Do the
`whereInSubquery` column-resolution fix first as a standalone correctness patch.

## Notes
Cross-package: requires coordination with the dialect cluster (model shape + rendering).
Confirm whether `JoinClause.on` is consumed as an opaque string elsewhere before changing
its shape.
