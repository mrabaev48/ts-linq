import { emitGroup, emitJoin, emitOrder, emitWhere } from '@ts-linq/dialect-kit';
import { MetadataStorage } from '@ts-linq/metadata';
import type { DialectVisitorSupport, DialectVisitorTranslators } from '@ts-linq/sql-visitor';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  BulkDeleteContext,
  BulkUpdateContext,
  ColumnMetadata,
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlParameter,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning
} from '@ts-linq/types';
import { TemporalNotSupportedError } from '@ts-linq/types';

import {
  buildPgBatchDelete,
  buildPgBatchInsert,
  buildPgBatchUpdate,
  PG_PARAM_LIMIT
} from './batch-syntax';
import { postgresEfFunctions } from './functions/index';
import { PostgresJsonPathTranslator } from './json/JsonPathTranslator';
import { postgresLtreeFunctions } from './ltree-functions';
import { quoteIdentifier, quoteStringLiteral } from './quoting';
import { createPostgresSpCallSyntax } from './sp-syntax';
import { postgisSpatialFunctions } from './spatial-functions';

/**
 * PostgreSQL implementation of SqlDialect.
 *
 * - Builds SELECT statements with optional JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/OFFSET
 * - Converts positional placeholders from '?' to PostgreSQL-style $1..$n
 * - Leaves identifier quoting to providers/metadata (table/column names are passed as-is)
 */
export class PostgresDialect implements SqlDialect, DialectVisitorSupport {
  private readonly jsonPathTranslator = new PostgresJsonPathTranslator();

  readonly parameterLimit = PG_PARAM_LIMIT;

  public quoteIdentifier(identifier: string): string {
    return quoteIdentifier(identifier);
  }

  /** Quote a string literal (escaping `'`) for interpolation into SQL string-literal positions. */
  public quoteStringLiteral(value: string): string {
    return quoteStringLiteral(value);
  }

  /**
   * Dialect-specific translators consumed by the `query` layer's SQL visitor factory so that
   * spatial / hierarchy (ltree) / JSON-path / EF.functions predicates render to PostgreSQL SQL.
   */
  public getVisitorTranslators(): DialectVisitorTranslators {
    return {
      spatialTranslator: postgisSpatialFunctions,
      hierarchyTranslator: postgresLtreeFunctions,
      efFunctionTranslator: postgresEfFunctions,
      jsonPathTranslator: this.jsonPathTranslator
    };
  }

  public getSpCallSyntax() {
    return createPostgresSpCallSyntax();
  }

  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    return buildPgBatchInsert(entities, metadata);
  }

  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    return buildPgBatchUpdate(entities, metadata);
  }

  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    return buildPgBatchDelete(entities, metadata);
  }
  /**
   * Generate a PostgreSQL SELECT query from normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/group/joins/limit/offset)
   */
  public buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult {
    if (options.temporal) {
      throw new TemporalNotSupportedError(
        'Temporal queries (FOR SYSTEM_TIME) are not supported by the PostgreSQL dialect. ' +
          'Use the @ts-linq/plugin-audit package for row-history tracking on PostgreSQL.'
      );
    }
    const parameters: SqlParameter[] = [];
    let query = this.buildSelectHead(options);
    query = this.applyCte(query, options);
    // SELECT-clause params must precede FROM params so numberPlaceholders assigns
    // correct $N indices (SELECT ? appears before FROM ... ? in the SQL string).
    this.collectSelectParams(parameters, options);
    if (options.rawSqlSource) {
      parameters.push(...options.rawSqlSource.params);
      query += ` FROM (${options.rawSqlSource.sql}) AS t0`;
    } else {
      const metadata = MetadataStorage.getEntity(entityClass);
      if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
      query += this.buildFromClause(options.from ?? metadata.viewName ?? metadata.tableName);
    }
    query += emitJoin(options, (id) => this.quoteIdentifier(id));
    query += emitWhere(parameters, options);
    query += emitGroup(parameters, options);
    query += emitOrder(options);
    query += this.buildLimitOffset(options);
    query = this.numberPlaceholders(query, parameters.length);
    return { query, parameters };
  }

  /** Replace all '?' placeholders by $1..$n according to their order. */
  private numberPlaceholders(sql: string, paramCount: number): string {
    if (paramCount === 0) return sql;
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `$${index}`;
    });
  }

  private buildSelectHead(options: QueryOptions): string {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  }

  private applyCte(query: string, options: QueryOptions): string {
    if (!options.cte) return query;
    return `WITH ${options.cte.name} AS (${options.cte.sql}) ` + query;
  }

  private buildFromClause(tableName: string): string {
    return ` FROM ${quoteIdentifier(tableName)}`;
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length) {
      parameters.push(...options.selectParams);
    }
  }

  private buildLimitOffset(options: QueryOptions): string {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    }
    if (hasOffset) {
      return ` OFFSET ${options.offset}`;
    }
    return '';
  }
  public buildInsert(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning {
    const primaryKeys = new Set<string>(metadata.primaryKeys ?? []);
    const hasValue = (propertyName: string): boolean => {
      const v = entity[propertyName];
      return v !== null && v !== undefined;
    };
    const cols = metadata.columns.filter((c) => {
      if (c.isComputed) return false;
      // Never include generated columns unless caller explicitly provided a value
      if (c.isGenerated && !hasValue(c.propertyName)) return false;
      // Heuristic: allow DB-generated PKs when value is missing even if metadata didn't mark it generated.
      // This matches common SERIAL/IDENTITY PK usage while still allowing explicit PK inserts.
      if (primaryKeys.has(c.propertyName) && !hasValue(c.propertyName)) return false;
      return true;
    });
    const names = cols.map((c) => quoteIdentifier(c.columnName));
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const parameters: SqlParameter[] = cols.map((c) =>
      this.coerceParameter(this.applyConverter(entity[c.propertyName], c))
    );
    const sql = `INSERT INTO ${quoteIdentifier(metadata.tableName)} (${names.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
    return { sql, parameters };
  }

  public buildUpdate(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${metadata.tableName}`);
    }
    const primaryKeys = metadata.primaryKeys;
    const setCols = metadata.columns.filter(
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    if (setCols.length === 0) throw new Error('No columns to update');

    const sets = setCols.map((c, i) => `${quoteIdentifier(c.columnName)} = $${i + 1}`);
    const parameters: SqlParameter[] = setCols.map((c) =>
      this.coerceParameter(this.applyConverter(entity[c.propertyName], c))
    );

    if (versionCol) {
      const versionId = quoteIdentifier(versionCol.columnName);
      sets.push(`${versionId} = ${versionId} + 1`);
    }

    const where = primaryKeys.map(
      (pk, i) =>
        `${quoteIdentifier(metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk)} = $${setCols.length + i + 1}`
    );
    const whereVals: SqlParameter[] = primaryKeys.map((pk) => {
      const col = metadata.columns.find((c) => c.propertyName === pk);
      return this.coerceParameter(col ? this.applyConverter(entity[pk], col) : entity[pk]);
    });
    parameters.push(...whereVals);

    let sql = `UPDATE ${quoteIdentifier(metadata.tableName)} SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`;

    if (versionCol) {
      sql += ` AND ${quoteIdentifier(versionCol.columnName)} = $${parameters.length + 1}`;
      parameters.push(
        this.coerceParameter(this.applyConverter(entity[versionCol.propertyName], versionCol))
      );
    }

    const tokens = (concurrencyTokens ?? []).filter((c) => !c.isVersion);
    for (const col of tokens) {
      const origVal = originalValues?.[col.propertyName] ?? entity[col.propertyName];
      sql += ` AND ${quoteIdentifier(col.columnName)} = $${parameters.length + 1}`;
      parameters.push(this.coerceParameter(this.applyConverter(origVal, col)));
    }

    return { sql, parameters };
  }

  public buildDelete(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${metadata.tableName}`);
    }
    const where = metadata.primaryKeys.map(
      (pk, i) =>
        `${quoteIdentifier(metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk)} = $${i + 1}`
    );
    const parameters: SqlParameter[] = metadata.primaryKeys.map((pk) =>
      this.coerceParameter(entity[pk])
    );
    let sql = `DELETE FROM ${quoteIdentifier(metadata.tableName)} WHERE ${where.join(' AND ')}`;

    for (const col of concurrencyTokens ?? []) {
      const origVal = originalValues?.[col.propertyName] ?? entity[col.propertyName];
      sql += ` AND ${quoteIdentifier(col.columnName)} = $${parameters.length + 1}`;
      parameters.push(this.coerceParameter(this.applyConverter(origVal, col)));
    }

    return { sql, parameters };
  }

  public buildBulkUpdate(ctx: BulkUpdateContext): SqlWithParams {
    const params: SqlParameter[] = [];
    const setClauses: string[] = [];

    for (const setter of ctx.setters) {
      const col = quoteIdentifier(setter.columnName);
      if (setter.value.kind === 'literal') {
        setClauses.push(`${col} = ?`);
        params.push(...setter.value.params);
      } else {
        setClauses.push(`${col} = ${quoteIdentifier(setter.value.refColumnName)}`);
      }
    }

    let sql = `UPDATE ${quoteIdentifier(ctx.tableName)} SET ${setClauses.join(', ')}`;

    if (ctx.where.length > 0) {
      const conditions = ctx.where.map((w) => w.condition).join(' AND ');
      for (const w of ctx.where) params.push(...w.parameters);
      sql += ` WHERE ${conditions}`;
    }

    sql = this.numberPlaceholders(sql, params.length);
    return { sql, parameters: params };
  }

  public buildBulkDelete(ctx: BulkDeleteContext): SqlWithParams {
    const params: SqlParameter[] = [];
    let sql = `DELETE FROM ${quoteIdentifier(ctx.tableName)}`;

    if (ctx.where.length > 0) {
      const conditions = ctx.where.map((w) => w.condition).join(' AND ');
      for (const w of ctx.where) params.push(...w.parameters);
      sql += ` WHERE ${conditions}`;
    }

    sql = this.numberPlaceholders(sql, params.length);
    return { sql, parameters: params };
  }

  private applyConverter(value: unknown, col: ColumnMetadata): unknown {
    return col.converter ? col.converter.toProvider(value) : value;
  }

  private coerceParameter(value: unknown): SqlParameter {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      value instanceof Uint8Array
    ) {
      return value;
    }
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return String(value);
    }
  }
}
