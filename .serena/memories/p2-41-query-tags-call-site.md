# P2-41 Query Tags / TagWithCallSite — Implementation (done)

## Status
Completed in feat/p2-41-query-tags → PR #105.

## Architecture

Tags stored on `QueryModel.tags?: readonly string[]`. Prepended to SQL **outside** the SQL cache (cache holds tag-free SQL). Tags do NOT affect the cache key.

## Public API

### @ts-linq/query
- `Queryable.tagWith(tag: string): Queryable<T>` — attach leading `-- <tag>` SQL comment
- `Queryable.tagWithCallSite(): Queryable<T>` — capture caller file:line via `Error().stack` and append as tag
- `Queryable.getTags(): QueryTagList` — inspect tag list without execution
- `QueryTagError` — thrown at call time for `\n`, `\r`, `*/` in tag
- `QueryTagList` type, `sanitizeTag()` exported from `@ts-linq/query`
- Key files: `src/ast/query-tags.ts`, `src/tag-with.ts`, `src/tag-with-call-site.ts`

### @ts-linq/orm
- `DbSet.tagWith()`, `DbSet.tagWithCallSite()`, `DbSet.getTags()` — delegation to `newQueryable()`
- `QueryTagList` imported from `@ts-linq/query`

### @ts-linq/sql-visitor
- `emitTagComments(tags: readonly string[]): string` — renders tag list as `-- t1\n-- t2\n` block
- Key file: `src/emit-tags.ts`

### @ts-linq/telemetry
- `parseTagsFromSql(sql: string): readonly string[] | undefined` — extracts leading `-- ` lines
- `TelemetryProvider.queryStart()` adds `db.query.tags` (JSON string[]) as OTEL span attribute
- Key file: `src/tag-span-attributes.ts`

## QueryBuilder integration
In `generateFromModel()`: after `generateSql()` (cache lookup), prepend `emitTagComments(model.tags)` to the query string. Tags never go into cache.

## QueryModel changes
- Added `tags?: QueryTagList` field
- `clone()` copies `tags` as a new array

## Test coverage
- `packages/query/tests-new/queryTags.test.ts` — unit tests
- `packages/sql-visitor/tests/emitTags.test.ts` — unit tests
- `packages/telemetry/tests-new/tagSpanAttributes.test.ts` — unit tests
- `packages/telemetry/tests-new/TelemetryProvider.tags.test.ts` — unit tests
- `packages/integration-tests/tests-new/07-advanced-features/queryTags.test.ts` — integration

## Validation results
- typecheck: 31/31 pass
- lint: 0 errors
- test:unit: 182 suites / 2239 tests
- test:integration: 40 suites / 312 tests
- build: 32/32 pass

## Related
- P2-45 (Logging) can read tags from SQL via `parseTagsFromSql()` — no new API needed
- Changeset: `.changeset/p2-41-query-tags-call-site.md`
- Docs: `apps/docs/query-tags.md`
