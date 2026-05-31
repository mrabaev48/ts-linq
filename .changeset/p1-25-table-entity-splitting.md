---
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/migrations": minor
---

feat(P1-25): implement table splitting and entity splitting

Introduces `TableFragmentMetadata` and `EntityMetadata.tableFragments` allowing one entity to be spread across multiple physical tables (entity splitting) and multiple entities to share a single table (table splitting).

Public API additions:
- `EntityTypeBuilder.splitToTable(tableName, configure, schema?)` — maps secondary properties of an entity to a separate table
- `TableSplitConfigBuilder.property(selector)` — configures which properties go into the fragment table
- `FragmentJoinPlanner.plan(meta)` — auto-generates INNER JOIN clauses for fragment tables in SELECT queries
- Two or more entities calling `.toTable()` with the same name merge into a single DDL table (table splitting)

Migration DDL now emits separate `CREATE TABLE` statements for each fragment. `SaveChanges` issues per-fragment INSERT/UPDATE/DELETE within the same transaction. Queries auto-join fragment tables via `FragmentJoinPlanner`.
