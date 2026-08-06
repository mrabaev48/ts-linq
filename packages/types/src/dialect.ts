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

// ─── Capability model ─────────────────────────────────────────────────────────
// Explicit feature matrix (Capability/Feature object) replacing method-presence sniffing:
// discoverable, testable, and serializable for tooling. Segregated per Interface Segregation —
// a dialect need not fake capabilities it doesn't have. Paired with the `require*` assertion
// functions in `runtime.ts`, which narrow `SqlDialect` to `SqlDialect & SupportsX` at call sites.

/** Feature matrix a dialect declares describing which optional capability groups it truly supports. */
export interface DialectCapabilities {
  readonly crud: boolean;
  readonly batch: boolean;
  readonly bulk: boolean;
  readonly storedProcedures: boolean;
  readonly temporal: boolean;
}

/** Segregated capability: single-row INSERT/UPDATE/DELETE. */
export interface SupportsCrud {
  buildInsert(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning;
  buildUpdate(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams;
  buildDelete(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams;
}

/** Segregated capability: multi-row batch INSERT/UPDATE/DELETE. */
export interface SupportsBatch {
  buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult;
  buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult;
  buildBatchDelete(entities: Record<string, unknown>[], metadata: EntityMetadata): SqlWithParams;
}

/** Segregated capability: single-statement bulk UPDATE/DELETE without loading entities. */
export interface SupportsBulk {
  buildBulkUpdate(ctx: BulkUpdateContext): SqlWithParams;
  buildBulkDelete(ctx: BulkDeleteContext): SqlWithParams;
}

/** Segregated capability: stored-procedure call syntax (P2-33). */
export interface SupportsStoredProcedures {
  getSpCallSyntax(): SpCallSyntax;
}

/**
 * Segregated capability marker for temporal (`FOR SYSTEM_TIME`) query support. Has no distinct
 * method — temporal support is enforced inside `buildSelect` itself (see
 * `AbstractSqlDialect.assertTemporalSupported`/`TemporalNotSupportedError`). The interface exists
 * for symmetry with the other capabilities and so `requireTemporal` can assert on
 * `dialect.capabilities.temporal` ahead of building a query (e.g. tooling deciding upfront whether
 * temporal DDL/queries are safe for a given dialect).
 */
export interface SupportsTemporal {}

// SQL Dialect interface
export interface SqlDialect {
  /**
   * Assemble a SELECT statement. `metadata` is resolved by the caller (parameterize-from-above) —
   * dialects must not reach into the global metadata registry themselves.
   *
   * `undefined` is allowed: it means the FROM target comes from `options.rawSqlSource` or
   * `options.from`. The dialect only raises `Entity metadata not found` when it actually needs the
   * table/view name. `entityClass` is retained for that diagnostic.
   */
  buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions,
    metadata: EntityMetadata | undefined
  ): SqlQueryResult;
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
  /**
   * Explicit capability matrix (Capability/Feature object). Optional for backward compatibility
   * with existing `SqlDialect` implementers (test doubles, custom dialects); the three production
   * dialects (`PostgresDialect`/`MysqlDialect`/`MssqlDialect`) always declare it. When absent, the
   * `require*` assertion helpers in `runtime.ts` fall back to method-presence sniffing.
   */
  readonly capabilities?: DialectCapabilities;
}

// ─── DDL strategy contract ────────────────────────────────────────────────────
// Implemented by every dialect via `AbstractDdlStrategy` (@ts-linq/dialect-kit). Migrations,
// scaffolding, and providers depend on this interface — never on the concrete classes — so a
// missing method is a compile error, not a runtime one (Dependency Inversion).

/** Maps a logical column type (+ optional length) to the dialect's physical SQL type (Strategy). */
export interface TypeMapper {
  mapType(logicalType: string, length?: number): string;
}

/** Foreign-key specification passed to {@link DdlStrategy.generateForeignKeySql}. */
export interface ForeignKeySpec {
  name: string;
  columnName: string;
  relatedTableName: string;
  relatedColumnName: string;
  onDelete?: string;
  onUpdate?: string;
}

/**
 * Minimal index specification shared by every dialect's `generateCreateIndexSql`. Concrete dialects
 * accept additional optional, dialect-specific fields (ordering, INCLUDE, etc.) on top of this.
 */
export interface CreateIndexSpec {
  name: string;
  columns: string[];
  unique: boolean;
}

/**
 * DDL generation contract for a SQL dialect. Owns CREATE TABLE / ALTER / FK / unique-constraint /
 * comment generation. The shared, invariant algorithm lives in `AbstractDdlStrategy`; each concrete
 * dialect supplies only a {@link TypeMapper} plus the genuinely divergent hooks.
 */
export interface DdlStrategy {
  generateCreateTableSql(metadata: EntityMetadata): string;
  generateColumnDefinition(column: Omit<ColumnMetadata, 'propertyName'>): string;
  /**
   * The `PRIMARY KEY (…)` table constraint, or `undefined` when the entity declares no key.
   * Exposed separately from {@link DdlStrategy.generateCreateTableSql} for callers that own their
   * own CREATE TABLE wrapper (`@ts-linq/migrations`) but must not re-derive key resolution/quoting.
   */
  generatePrimaryKeyClause(metadata: EntityMetadata): string | undefined;
  generateCreateIndexSql(tableName: string, index: CreateIndexSpec): string;
  generateAddColumnSql(tableName: string, column: Omit<ColumnMetadata, 'propertyName'>): string;
  generateDropColumnSql(tableName: string, columnName: string): string;
  generateAlterColumnTypeSql(tableName: string, columnName: string, newType: string): string;
  generateRenameTableSql(tableName: string, newTableName: string): string;
  generateForeignKeySql(tableName: string, fk: ForeignKeySpec): string;
  generateAddUniqueConstraintSql(tableName: string, name: string, columns: string[]): string;
  generateDropUniqueConstraintSql(tableName: string, name: string): string;
  generateCommentSql(metadata: EntityMetadata): string[];
}
