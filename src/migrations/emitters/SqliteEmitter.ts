import { BaseEmitter } from './BaseEmitter';

export class SqliteEmitter extends BaseEmitter {}
// RENAME CONSTRAINT is not supported in SQLite; keep BaseEmitter default (no-op comments via higher-level logic)
