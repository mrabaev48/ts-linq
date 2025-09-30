import type {
  SqlDialect,
  OrderByClause,
  QueryOptions,
  WhereClause,
  SqlParameter
} from '@ts-linq/core';
import { MetadataStorage, JoinClause } from '@ts-linq/core';

/**
 * SQLite implementation of SqlDialect.
 * Handles DISTINCT, WHERE (prebuilt), GROUP BY/HAVING, ORDER BY and LIMIT/OFFSET.
 * Adds SQLite-specific quirk: LIMIT -1 when OFFSET is provided without LIMIT.
 */
export class SQLiteDialect implements SqlDialect {
  public quoteIdentifier(identifier: string): string {
    return identifier;
  }
  /** Build SQL for a SELECT based on normalized QueryOptions.
   * @param entityClass Entity constructor (for table name resolution)
   * @param options Normalized query options
   */
  buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const parameters: SqlParameter[] = [];
    let query = this.buildSelectHead(options);
    query += this.buildFromClause(options.from ?? metadata.tableName);
    query += this.buildJoins(options);
    this.collectSelectParams(parameters, options);
    query += this.buildWhereClause(parameters, options);
    query += this.buildGroupByHaving(parameters, options);
    query += this.buildOrderBy(options);
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
    return ` FROM ${tableName}`;
  }

  private buildJoins(options: QueryOptions): string {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${join.on}`;
    }
    return out;
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length)
      parameters.push(...options.selectParams);
  }

  private buildWhereClause(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.where || options.where.length === 0) return '';
    const whereClauses = options.where.map((w: WhereClause) => w.condition);
    for (const w of options.where) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }

  private buildGroupByHaving(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.groupBy) return '';
    let sql = ` GROUP BY ${options.groupBy.columns.join(', ')}`;
    if (options.groupBy.having) {
      sql += ` HAVING ${options.groupBy.having.condition}`;
      parameters.push(...options.groupBy.having.parameters);
    }
    return sql;
  }

  private buildOrderBy(options: QueryOptions): string {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o: OrderByClause) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
  }

  private buildLimitOffset(options: QueryOptions): string {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    }
    if (hasOffset) {
      return ` LIMIT -1 OFFSET ${options.offset}`;
    }
    return '';
  }
}
