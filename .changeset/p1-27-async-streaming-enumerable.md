---
"@ts-linq/core": minor
"@ts-linq/query": minor
"@ts-linq/orm": minor
"@ts-linq/provider-mssql": minor
---

feat(P1-27): add asAsyncEnumerable / forEachAsync / toDictionaryAsync streaming operators

Enables memory-bounded processing of large result sets via chunked OFFSET pagination (1000 rows per chunk by default). Mirrors EF Core's streaming API.

**New public APIs on `Queryable<T>` and `DbSet<T>`:**
- `asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T>` — streams entities via `for await`, respects `.take()` and `.skip()` on the chain
- `forEachAsync(action, signal?): Promise<void>` — async forEach over streamed entities
- `toDictionaryAsync<K>(keySelector, signal?): Promise<Map<K, T>>` — keyed map, throws on duplicate keys
- `toDictionaryAsync<K, V>(keySelector, elementSelector, signal?): Promise<Map<K, V>>` — projected keyed map

**New `DatabaseProvider` streaming primitives:**
- `streamRows(baseSql, params, startOffset, maxRows?, signal?): AsyncIterable<Row>` — chunked pagination primitive
- `buildChunkSql(baseSql, chunkLimit, offset): string` — protected, overridable per dialect

**Provider changes:**
- `MssqlProvider.buildChunkSql`: uses `OFFSET n ROWS FETCH NEXT m ROWS ONLY` with automatic `ORDER BY (SELECT NULL)` injection when ORDER BY is absent

**AbortSignal support:** cancellation is checked between chunks (granularity: 1000 rows by default).

**EF Core error parity:** `toDictionaryAsync` throws `"An item with the same key has already been added. Key: <key>"` on duplicate keys.

**Limitations (documented):**
- `include()`/`thenInclude()` are not populated during streaming; use `toListAsync()` when eager loading is required.
- `NoTrackingWithIdentityResolution` falls back to no-tracking in streaming path.
