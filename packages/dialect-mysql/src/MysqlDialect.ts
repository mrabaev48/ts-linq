import { MetadataStorage } from '@ts-linq/metadata';
import type {
  BatchInsertResult,
  BatchUpdateResult,
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
  buildMysqlBatchDelete,
  buildMysqlBatchInsert,
  buildMysqlBatchUpdate,
  MYSQL_PARAM_LIMIT
} from './batch-syntax';
import { MySqlGroupEmitter } from './emitters/MySqlGroupEmitter';
import { MySqlJoinEmitter } from './emitters/MySqlJoinEmitter';
import { MySqlOrderEmitter } from './emitters/MySqlOrderEmitter';
import { MySqlWhereEmitter } from './emitters/MySqlWhereEmitter';

/**
 * MySQL dialect for SELECT generation.
 *
 * - Uses LIMIT and OFFSET (LIMIT n OFFSET m)
 * - Leaves '?' placeholders as-is (mysql2 supports positional params)
 */
export class MysqlDialect implements SqlDialect {
  private readonly whereEmitter = new MySqlWhereEmitter();
  private readonly joinEmitter = new MySqlJoinEmitter();
  private readonly orderEmitter = new MySqlOrderEmitter();
  private readonly groupEmitter = new MySqlGroupEmitter();

  readonly parameterLimit = MYSQL_PARAM_LIMIT;

  public quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    return buildMysqlBatchInsert(entities, metadata);
  }

  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    return buildMysqlBatchUpdate(entities, metadata);
  }

  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    return buildMysqlBatchDelete(entities, metadata);
  }
  /**
   * Build SELECT for MySQL based on normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/joins/group/limit/offset)
   */
  public buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult {
    if (options.temporal) {
      throw new TemporalNotSupportedError(
        'Temporal queries (FOR SYSTEM_TIME) are not supported by the MySQL dialect. ' +
          'Use the @ts-linq/plugin-audit package for row-history tracking on MySQL.'
      );
    }
    const parameters: SqlParameter[] = [];
    let query = this.buildSelectHead(options);
    // SELECT-clause params must precede FROM params so placeholder indices are correct.
    this.collectSelectParams(parameters, options);
    if (options.rawSqlSource) {
      parameters.push(...options.rawSqlSource.params);
      query += ` FROM (${options.rawSqlSource.sql}) AS t0`;
    } else {
      const metadata = MetadataStorage.getEntity(entityClass);
      if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
      query += this.buildFromClause(options.from ?? metadata.tableName);
    }
    query += this.joinEmitter.emit(options);
    query += this.whereEmitter.emit(parameters, options);
    query += this.groupEmitter.emit(parameters, options);
    query += this.orderEmitter.emit(options);
    query += this.buildLimitOffset(options);
    return { query, parameters };
  }

  private buildSelectHead(options: QueryOptions): string {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  }

  private buildFromClause(tableName: string): string {
    return ` FROM \`${tableName}\``;
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length)
      parameters.push(...options.selectParams);
  }

  private buildLimitOffset(options: QueryOptions): string {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    }
    if (hasOffset) {
      return ` LIMIT 18446744073709551615 OFFSET ${options.offset}`;
    }
    return '';
  }
  public buildInsert(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning {
    const insertable = metadata.columns.filter(
      (c) => (!c.isGenerated || entity[c.propertyName] !== undefined) && !c.isComputed
    );
    const names = insertable.map((c) => c.columnName);
    const placeholders = insertable.map(() => '?');
    const parameters: SqlParameter[] = insertable.map((c) =>
      this.coerceParameter(entity[c.propertyName])
    );
    return {
      sql: `INSERT INTO ${metadata.tableName} (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
      parameters
    };
  }

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
      (c) => !primaryKeys.includes(c.propertyName) && !c.isGenerated && !c.isComputed
    );
    const setClauses: string[] = updatable.map((c) => `${c.columnName} = ?`);
    const setParams: SqlParameter[] = updatable.map((c) =>
      this.coerceParameter(entity[c.propertyName])
    );
    if (versionCol) setClauses.push(`${versionCol.columnName} = ${versionCol.columnName} + 1`);
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
    const sql = `UPDATE ${metadata.tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    return { sql, parameters: [...setParams, ...whereParams] };
  }

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
    const sql = `DELETE FROM ${metadata.tableName} WHERE ${whereClauses.join(' AND ')}`;
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
