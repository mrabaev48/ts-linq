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

import {
  buildMssqlBatchDelete,
  buildMssqlBatchInsert,
  buildMssqlBatchUpdate,
  MSSQL_PARAM_LIMIT
} from './batch-syntax';
import { buildTemporalClause } from './emit-temporal';
import { MssqlGroupEmitter } from './emitters/MssqlGroupEmitter';
import { MssqlJoinEmitter } from './emitters/MssqlJoinEmitter';
import { MssqlOrderEmitter } from './emitters/MssqlOrderEmitter';
import { MssqlWhereEmitter } from './emitters/MssqlWhereEmitter';
import { mssqlEfFunctions } from './functions/index';
import { mssqlHierarchyFunctions } from './hierarchy-functions';
import { MssqlJsonPathTranslator } from './json/JsonPathTranslator';
import { createMssqlSpCallSyntax } from './sp-syntax';
import { mssqlSpatialFunctions } from './spatial-functions';

/**
 * MSSQL dialect for SELECT generation.
 *
 * - Adds TOP n when limit is used without offset
 * - Uses OFFSET n ROWS FETCH NEXT m ROWS ONLY when offset is provided
 * - Converts '?' placeholders to @p1..@pn for MSSQL parameter style
 */
export class MssqlDialect implements SqlDialect, DialectVisitorSupport {
  private readonly whereEmitter = new MssqlWhereEmitter();
  private readonly joinEmitter = new MssqlJoinEmitter();
  private readonly orderEmitter = new MssqlOrderEmitter();
  private readonly groupEmitter = new MssqlGroupEmitter();
  private readonly jsonPathTranslator = new MssqlJsonPathTranslator();

  readonly parameterLimit = MSSQL_PARAM_LIMIT;

  public quoteIdentifier(identifier: string): string {
    return `[${identifier.replace(/]/g, ']]')}]`;
  }

  /**
   * Dialect-specific translators consumed by the `query` layer's SQL visitor factory so that
   * spatial / hierarchyid / JSON-path / EF.functions predicates render to T-SQL.
   */
  public getVisitorTranslators(): DialectVisitorTranslators {
    return {
      spatialTranslator: mssqlSpatialFunctions,
      hierarchyTranslator: mssqlHierarchyFunctions,
      efFunctionTranslator: mssqlEfFunctions,
      jsonPathTranslator: this.jsonPathTranslator
    };
  }

  public getSpCallSyntax() {
    return createMssqlSpCallSyntax();
  }

  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    return buildMssqlBatchInsert(entities, metadata);
  }

  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    return buildMssqlBatchUpdate(entities, metadata);
  }

  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    return buildMssqlBatchDelete(entities, metadata);
  }
  /**
   * Build a SELECT statement for MSSQL based on normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name from metadata
   * @param options Normalized query options (select/where/joins/order/limit/offset)
   * @returns SQL string and positional parameter array
   */
  public buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult {
    const parameters: SqlParameter[] = [];
    this.collectSelectParams(parameters, options);
    const selectList = options.select && options.select.length ? options.select.join(', ') : '*';
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    const selectHead = this.buildSelectHead(options, hasLimit, hasOffset);
    let query: string;
    if (options.rawSqlSource) {
      parameters.push(...options.rawSqlSource.params);
      query = `${selectHead}${selectList} FROM (${options.rawSqlSource.sql}) AS t0`;
    } else {
      const metadata = MetadataStorage.getEntity(entityClass);
      if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
      query = `${selectHead}${selectList} FROM [${options.from ?? metadata.viewName ?? metadata.tableName}]`;
      if (options.temporal) {
        query += buildTemporalClause(options.temporal, parameters);
      }
    }
    query += this.joinEmitter.emit(options);
    query += this.whereEmitter.emit(parameters, options);
    query += this.groupEmitter.emit(parameters, options);
    query += this.orderEmitter.emit(options);
    query += this.buildOffsetFetch(options, hasLimit, hasOffset);
    query = this.numberPlaceholders(query, parameters.length);
    return { query, parameters };
  }

  /** Replace '?' placeholders with @p1..@pn. */
  private numberPlaceholders(sql: string, paramCount: number): string {
    if (paramCount === 0) return sql;
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `@p${index}`;
    });
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length)
      parameters.push(...options.selectParams);
  }

  private buildSelectHead(options: QueryOptions, hasLimit: boolean, hasOffset: boolean): string {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    if (hasLimit && !hasOffset) head += `TOP (${options.limit}) `;
    return head;
  }

  private buildOffsetFetch(options: QueryOptions, hasLimit: boolean, hasOffset: boolean): string {
    if (!hasOffset) return '';
    let sql = '';
    if (!options.orderBy || options.orderBy.length === 0) {
      sql += ' ORDER BY (SELECT NULL)';
    }
    const fetchNext = hasLimit ? ` FETCH NEXT ${options.limit} ROWS ONLY` : '';
    sql += ` OFFSET ${options.offset} ROWS${fetchNext}`;
    return sql;
  }
  /**
   * Build INSERT statement.
   */
  public buildInsert(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning {
    const insertable = metadata.columns.filter(
      (col) => !col.isGenerated || entity[col.propertyName] !== undefined
    );
    const columnNames = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const parameters: SqlParameter[] = insertable.map((c) =>
      this.coerceParameter(this.applyConverter(entity[c.propertyName], c))
    );

    const firstPk = metadata.primaryKeys?.[0];
    const pkColMeta = firstPk
      ? metadata.columns.find((c) => c.propertyName === firstPk)
      : undefined;
    const returningPk = pkColMeta?.isGenerated ? firstPk : undefined;

    let sql: string;
    if (returningPk && pkColMeta) {
      sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) OUTPUT INSERTED.[${pkColMeta.columnName}] AS id VALUES (${placeholders.join(', ')})`;
    } else {
      sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES (${placeholders.join(', ')})`;
    }

    // Replace ? with @pN
    sql = this.numberPlaceholders(sql, parameters.length);

    return { sql, parameters, returningPk };
  }

  /**
   * Build UPDATE statement.
   */
  public buildUpdate(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for entity ${metadata.tableName}`);
    }
    const primaryKeys = metadata.primaryKeys;
    const updatable = metadata.columns.filter(
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated
    );
    if (updatable.length === 0) throw new Error(`No updatable columns for ${metadata.tableName}`);

    const setClauses: string[] = updatable.map((c) => `${c.columnName} = ?`);
    const setParams: SqlParameter[] = updatable.map((c) =>
      this.coerceParameter(this.applyConverter(entity[c.propertyName], c))
    );

    if (versionCol) {
      setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    }

    const whereClauses: string[] = [];
    const whereParams: SqlParameter[] = [];
    for (const pk of primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      whereParams.push(this.coerceParameter(this.applyConverter(entity[pk], col)));
    }

    if (versionCol) {
      whereClauses.push(`${versionCol.columnName} = ?`);
      whereParams.push(
        this.coerceParameter(this.applyConverter(entity[versionCol.propertyName], versionCol))
      );
    }

    for (const col of (concurrencyTokens ?? []).filter((c) => !c.isVersion)) {
      const origVal = originalValues?.[col.propertyName] ?? entity[col.propertyName];
      whereClauses.push(`${col.columnName} = ?`);
      whereParams.push(this.coerceParameter(this.applyConverter(origVal, col)));
    }

    let sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

    // Replace ? with @pN
    const allParams = [...setParams, ...whereParams];
    sql = this.numberPlaceholders(sql, allParams.length);

    return { sql, parameters: allParams };
  }

  /**
   * Build DELETE statement.
   */
  public buildDelete(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) {
      throw new Error(`No primary key defined for entity ${metadata.tableName}`);
    }
    const whereClauses: string[] = [];
    const parameters: SqlParameter[] = [];
    for (const pk of metadata.primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      parameters.push(this.coerceParameter(entity[pk]));
    }
    for (const col of concurrencyTokens ?? []) {
      const origVal = originalValues?.[col.propertyName] ?? entity[col.propertyName];
      whereClauses.push(`${col.columnName} = ?`);
      parameters.push(this.coerceParameter(this.applyConverter(origVal, col)));
    }
    let sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClauses.join(' AND ')}`;

    // Replace ? with @pN
    sql = this.numberPlaceholders(sql, parameters.length);

    return { sql, parameters };
  }

  public buildBulkUpdate(ctx: BulkUpdateContext): SqlWithParams {
    const params: SqlParameter[] = [];
    const setClauses: string[] = [];

    for (const setter of ctx.setters) {
      const col = `[${setter.columnName}]`;
      if (setter.value.kind === 'literal') {
        setClauses.push(`${col} = ?`);
        params.push(...setter.value.params);
      } else {
        setClauses.push(`${col} = [${setter.value.refColumnName}]`);
      }
    }

    let sql = `UPDATE [${ctx.tableName}] SET ${setClauses.join(', ')}`;

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
    let sql = `DELETE FROM [${ctx.tableName}]`;

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
