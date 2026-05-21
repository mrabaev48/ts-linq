# @ts-linq/query

## 2.1.1

### Patch Changes

- Updated dependencies [[`11583da`](https://github.com/mrabaev48/ts-linq/commit/11583daee8abd16f5e0a21bd72eecd396d94789c)]:
  - @ts-linq/ast@2.2.0
  - @ts-linq/core@1.3.0
  - @ts-linq/sql-visitor@2.2.0
  - @ts-linq/types@2.2.0
  - @ts-linq/metadata@2.0.2

## 2.1.0

### Minor Changes

- [#95](https://github.com/mrabaev48/ts-linq/pull/95) [`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb) Thanks [@mrabaev48](https://github.com/mrabaev48)! - feat(P1-27): add asAsyncEnumerable / forEachAsync / toDictionaryAsync streaming operators

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

### Patch Changes

- Updated dependencies [[`6e83ca9`](https://github.com/mrabaev48/ts-linq/commit/6e83ca9ce576f309f0959b10cd0b43566012f4fb), [`1c2b714`](https://github.com/mrabaev48/ts-linq/commit/1c2b714b8b72a0a15fc94c11c1be40dc12597a9a)]:
  - @ts-linq/core@1.2.0
  - @ts-linq/ast@2.1.0
  - @ts-linq/types@2.1.0
  - @ts-linq/sql-visitor@2.1.0
  - @ts-linq/metadata@2.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`389c97c`](https://github.com/mrabaev48/ts-linq/commit/389c97c1f88a2dc3b09d216ab2bce087d360640d)]:
  - @ts-linq/core@1.1.0
  - @ts-linq/types@2.0.0
  - @ts-linq/ast@2.0.0
  - @ts-linq/metadata@2.0.0
  - @ts-linq/sql-visitor@2.0.0
