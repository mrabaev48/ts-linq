// SQL dialect contract and DML result types

import type { ColumnMetadata, EntityMetadata } from './metadata';
import type { QueryOptions, SqlParameter, WhereClause } from './sql';
import type { SpCallSyntax } from './stored-procedure';

// SQL dialect result types
export interface SqlQueryResult {
  query: string;
  parameters: readonly SqlParameter[];
}

export interface SqlWithParams {
  sql: string;
  parameters: SqlParameter[];
}

export interface SqlWithReturning extends SqlWithParams {
  returningPk?: string;
}

/** Result from a dialect batch INSERT — sql + params for the multi-row statement. */
export interface BatchInsertResult {
  sql: string;
  parameters: SqlParameter[];
  /** Whether the INSERT statement itself returns the inserted rows inline (PG RETURNING, MSSQL OUTPUT).
   *  When false, a separate query is needed to retrieve generated PKs (e.g. MySQL LAST_INSERT_ID). */
  returnsRows?: boolean;
  /** Optional SELECT to retrieve the first auto-generated ID after INSERT (MySQL only). */
  fetchFirstInsertIdSql?: string;
}

/** Result from a dialect batch UPDATE.
 *  PG / MSSQL return a single CTE/JOIN statement; MySQL returns multiple per-row statements. */
export interface BatchUpdateResult {
  /** Single multi-row statement (Postgres / MSSQL). */
  sql?: string;
  parameters?: SqlParameter[];
  /** Multiple per-row statements (MySQL). */
  statements?: Array<{ sql: string; parameters: SqlParameter[] }>;
}

// Bulk DML (ExecuteUpdate / ExecuteDelete) types

/** Describes one SET assignment in a bulk UPDATE. */
export interface SetterSpec {
  columnName: string;
  value: { kind: 'literal'; params: SqlParameter[] } | { kind: 'column'; refColumnName: string };
}

/** Context passed to SqlDialect.buildBulkUpdate(). */
export interface BulkUpdateContext {
  tableName: string;
  setters: SetterSpec[];
  where: WhereClause[];
}

/** Context passed to SqlDialect.buildBulkDelete(). */
export interface BulkDeleteContext {
  tableName: string;
  where: WhereClause[];
}

// SQL Dialect interface
export interface SqlDialect {
  buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult;
  buildInsert?(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning;
  buildUpdate?(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams;
  buildDelete?(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams;
  quoteIdentifier(identifier: string): string;
  /** Maximum number of bind parameters this dialect/driver supports per statement. */
  readonly parameterLimit?: number;
  buildBatchInsert?(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult;
  buildBatchUpdate?(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult;
  buildBatchDelete?(entities: Record<string, unknown>[], metadata: EntityMetadata): SqlWithParams;
  /** Bulk UPDATE: single-statement SET ... WHERE without loading entities. */
  buildBulkUpdate?(ctx: BulkUpdateContext): SqlWithParams;
  /** Bulk DELETE: single-statement DELETE ... WHERE without loading entities. */
  buildBulkDelete?(ctx: BulkDeleteContext): SqlWithParams;
  /** Return the SP call syntax emitter for this dialect (P2-33). */
  getSpCallSyntax?(): SpCallSyntax;
}
