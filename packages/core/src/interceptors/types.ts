import type { SqlParameter } from '@ts-linq/types';

/** Represents a database command about to be (or just) executed. */
export interface DbCommand {
  sql: string;
  params: readonly SqlParameter[];
  traceId?: string;
}

/** Context passed to command interceptor hooks. */
export interface CommandEventData {
  commandText: string;
  durationMs?: number;
  isReader: boolean;
}

/** Result of a reader (SELECT) execution. */
export interface DbReader {
  rows: unknown[];
}

/** A single entity change entry passed to SaveChanges interceptors. */
export interface SaveChangesEntry {
  entity: object;
  entityClass: Function;
  state: string;
}

/** Context passed to SaveChanges interceptor hooks. */
export interface SaveChangesEventData {
  entityCount: number;
  entries?: ReadonlyArray<SaveChangesEntry>;
}

/** Context passed to materialization interceptor hooks. */
export interface MaterializationInterceptionData {
  entityType: Function;
}

/** Context passed to connection interceptor hooks. */
export interface ConnectionEventData {
  durationMs?: number;
}

/** Context passed to transaction interceptor hooks. */
export interface TransactionEventData {
  traceId?: string;
  durationMs?: number;
}
