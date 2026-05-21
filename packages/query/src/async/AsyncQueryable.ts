/**
 * @internal
 * Internal constants and types for async streaming operators on Queryable<T>.
 * (asAsyncEnumerable / forEachAsync / toDictionaryAsync)
 */

/** Number of rows fetched per chunk in asAsyncEnumerable streaming. */
export const STREAMING_CHUNK_SIZE = 1000;
