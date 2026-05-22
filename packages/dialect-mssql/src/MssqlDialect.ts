import { MetadataStorage } from '@ts-linq/metadata';
import type {
  ColumnMetadata,
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlParameter,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning
} from '@ts-linq/types';

import { buildTemporalClause } from './emit-temporal';
import { MssqlGroupEmitter } from './emitters/MssqlGroupEmitter';
import { MssqlJoinEmitter } from './emitters/MssqlJoinEmitter';
import { MssqlOrderEmitter } from './emitters/MssqlOrderEmitter';
import { MssqlWhereEmitter } from './emitters/MssqlWhereEmitter';

/**
 * MSSQL dialect for SELECT generation.
 *
 * - Adds TOP n when limit is used without offset
 * - Uses OFFSET n ROWS FETCH NEXT m ROWS ONLY when offset is provided
 * - Converts '?' placeholders to @p1..@pn for MSSQL parameter style
 */
export class MssqlDialect implements SqlDialect {
  private readonly whereEmitter = new MssqlWhereEmitter();
  private readonly joinEmitter = new MssqlJoinEmitter();
  private readonly orderEmitter = new MssqlOrderEmitter();
  private readonly groupEmitter = new MssqlGroupEmitter();
  public quoteIdentifier(identifier: string): string {
    return `[${identifier.replace(/]/g, ']]')}]`;
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
      query = `${selectHead}${selectList} FROM [${options.from ?? metadata.tableName}]`;
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
      this.coerceParameter(entity[c.propertyName])
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
    versionCol?: ColumnMetadata
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
      this.coerceParameter(entity[c.propertyName])
    );

    if (versionCol) {
      setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
    }

    const whereClauses: string[] = [];
    const whereParams: SqlParameter[] = [];
    for (const pk of primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk)!;
      whereClauses.push(`${col.columnName} = ?`);
      whereParams.push(this.coerceParameter(entity[pk]));
    }

    if (versionCol) {
      whereClauses.push(`${versionCol.columnName} = ?`);
      whereParams.push(this.coerceParameter(entity[versionCol.propertyName]));
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
  public buildDelete(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithParams {
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
    let sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClauses.join(' AND ')}`;

    // Replace ? with @pN
    sql = this.numberPlaceholders(sql, parameters.length);

    return { sql, parameters };
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
