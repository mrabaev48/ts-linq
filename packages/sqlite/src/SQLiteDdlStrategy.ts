import type { EntityMetadata, ColumnMetadata } from '@ts-linq/core';
import { SqlHelper } from '@ts-linq/core';

type LoggerLike = { warn(message: string, error?: unknown): void };
import { SQLiteIndexBuilder } from './builders/SQLiteIndexBuilder';

/**
 * @deprecated Use SQLiteDdlStrategy from @ts-linq/dialect-sqlite instead.
 */
export { SQLiteDdlStrategy } from '@ts-linq/dialect-sqlite';
