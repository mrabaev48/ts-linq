---
"@ts-linq/query": minor
"@ts-linq/sql-visitor": minor
"@ts-linq/telemetry": minor
"@ts-linq/orm": minor
---

Add `tagWith()` / `tagWithCallSite()` query tagging API (mirrors EF Core 8 `TagWith` / `TagWithCallSite`).

Tags are emitted as leading `-- comment` SQL lines before the statement, making queries identifiable
in DBA tools, query stores, and slow-query logs without ambiguity.

Key changes:
- `Queryable.tagWith(tag)`: attach a diagnostic string comment to the emitted SQL. Multiple calls accumulate in order.
- `Queryable.tagWithCallSite()`: auto-capture caller's source file and line via `Error().stack` and append as a tag.
- `Queryable.getTags()`: inspect the current tag list without executing.
- `DbSet.tagWith()` / `DbSet.tagWithCallSite()` / `DbSet.getTags()`: delegation methods on `DbSet<T>`.
- `QueryTagError`: thrown at call time when a tag contains newlines or comment-break sequences (`*/`).
- `QueryTagList` type and `sanitizeTag()` exported from `@ts-linq/query`.
- `emitTagComments(tags)` exported from `@ts-linq/sql-visitor`: converts a tag list to a SQL comment block.
- `parseTagsFromSql(sql)` exported from `@ts-linq/telemetry`: extracts leading `-- ` comment lines from SQL.
- `TelemetryProvider.queryStart()` now adds `db.query.tags` as a structured OTEL span attribute when tags are present.
- Tags are NOT part of the SQL cache key — the clean SQL is cached, tags are prepended at execution time.
