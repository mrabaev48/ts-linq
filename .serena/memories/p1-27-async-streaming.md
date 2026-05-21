# P1-27: Async Streaming Operators (asAsyncEnumerable / forEachAsync / toDictionaryAsync)

## Status: COMPLETED (PR #95, branch feat/p1-27-async-streaming-enumerable)

## New Public API

### Queryable<T> and DbSet<T> — three new terminal operators
- `asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T>` — streams entities via `for await`
- `forEachAsync(action: (entity: T) => void | Promise<void>, signal?: AbortSignal): Promise<void>`
- `toDictionaryAsync<K>(keySelector, signal?): Promise<Map<K, T>>`
- `toDictionaryAsync<K, V>(keySelector, elementSelector, signal?): Promise<Map<K, V>>`

### DatabaseProvider — new streaming primitives
- `protected buildChunkSql(baseSql, chunkLimit, offset): string` — virtual method, default: `LIMIT x OFFSET y`
- `public async* streamRows(baseSql, params, startOffset, maxRows?, signal?): AsyncIterable<Record<string,unknown>>`

## Architecture

### Streaming strategy
Chunked OFFSET/LIMIT pagination (CHUNK_SIZE = 1000 rows). No native driver cursors — avoids new dependencies and works across all three providers.

### Critical: streamRows bypasses executeWithRetry
`streamRows` calls `doExecuteQuery` directly. Retry on a partially-yielded stream would cause duplicate rows. This is intentional and must NOT be changed.

### MSSQL dialect override
`MssqlProvider.buildChunkSql` emits `OFFSET n ROWS FETCH NEXT m ROWS ONLY` and auto-injects `ORDER BY (SELECT NULL)` when ORDER BY is absent (MSSQL requires ORDER BY before OFFSET/FETCH).

### Tracking in streaming
`asAsyncEnumerable` applies `_entityAttacher.attach()` per-entity inline when `TrackAll` is active. Cannot use the batch `_applyTracking` method.

### Known limitations (documented)
- `include()`/`thenInclude()` are silently ignored in streaming path; use `toListAsync()` for eager loading
- `NoTrackingWithIdentityResolution` falls back to no-tracking (no identity map in streaming path)

## Key files
- `packages/core/src/DatabaseProvider.ts` — `streamRows`, `buildChunkSql`
- `packages/core/src/types/index.ts` — `streamRows` in `IDatabaseProvider`
- `packages/query/src/Queryable.ts` — three terminal operators
- `packages/query/src/async/AsyncQueryable.ts` — `STREAMING_CHUNK_SIZE = 1000`
- `packages/query/src/index.ts` — re-exports `STREAMING_CHUNK_SIZE` (required for arch:deps no-orphans)
- `packages/orm/src/DbSet.ts` — delegates to inner `newQueryable()`
- `packages/provider-mssql/src/MssqlProvider.ts` — overrides `buildChunkSql`

## Tests
- Unit: `packages/query/tests-new/async/AsyncEnumerable.test.ts` (22 tests)
- E2E: `packages/e2e-tests/tests/queries/async-enumerable.e2e.test.ts` (9 tests, all 3 providers)

## Changeset
`.changeset/p1-27-async-streaming-enumerable.md` — minor bump: core, query, orm, provider-mssql
