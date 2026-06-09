---
"@ts-linq/ast": major
"@ts-linq/sql-visitor": minor
---

Relocate the rendered-SQL-fragment DTOs out of the pure-AST package.

`ConditionFragment` (`{ condition, parameters }`) and `SqlFragment` (`{ fragment, params }`)
describe *already-rendered* SQL — a SQL-generation concern, not an AST-node concern. They have
moved to `@ts-linq/sql-visitor`, which is their only consumer, so `@ts-linq/ast` is now strictly
a pure node-definition + typed-error layer with zero SQL-generation surface.

**What changed**

- **`@ts-linq/ast`** (major) — **removed** `ConditionFragment` and `SqlFragment` from the public
  API (`src/types.ts` deleted; no longer re-exported from the barrel). A backward-compatible
  re-export is intentionally **not** provided: `@ts-linq/ast` may depend only on `@ts-linq/types`,
  so re-exporting from `@ts-linq/sql-visitor` would violate the package boundary and create a
  dependency cycle.
- **`@ts-linq/sql-visitor`** (minor) — now **owns and exports** `ConditionFragment` and
  `SqlFragment` (new `src/types.ts`). Internal visitors were migrated to the local definitions.
  No runtime or shape change.

**Migration**

Import `ConditionFragment` / `SqlFragment` from `@ts-linq/sql-visitor` instead of
`@ts-linq/ast`. The shapes are unchanged; only the import path moved.
