import type { SqlDialect, QueryOptions, SqlParameter, WhereClause, GroupByClause } from '@ts-linq/types';
import { MetadataStorage } from '@ts-linq/metadata';
import { PgWhereEmitter } from './emitters/PgWhereEmitter';
import { PgJoinEmitter } from './emitters/PgJoinEmitter';
import { PgOrderEmitter } from './emitters/PgOrderEmitter';
import { PgGroupEmitter } from './emitters/PgGroupEmitter';

/**
 * PostgreSQL implementation of SqlDialect.
 *
 * - Builds SELECT statements with optional JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/OFFSET
 * - Converts positional placeholders from '?' to PostgreSQL-style $1..$n
 * - Leaves identifier quoting to providers/metadata (table/column names are passed as-is)
 */
export class PostgresDialect implements SqlDialect {
  private readonly whereEmitter = new PgWhereEmitter();
  private readonly joinEmitter = new PgJoinEmitter();
  private readonly orderEmitter = new PgOrderEmitter();
  private readonly groupEmitter = new PgGroupEmitter();
  public quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
  /**
   * Generate a PostgreSQL SELECT query from normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/group/joins/limit/offset)
   */
  public buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    const parameters: SqlParameter[] = [];
    let query = this.buildSelectHead(options);
    query = this.applyCte(query, options);
    query += this.buildFromClause(options.from ?? metadata.tableName);
    query += this.joinEmitter.emit(options);
    this.collectSelectParams(parameters, options);
    query += this.whereEmitter.emit(parameters, options);
    query += this.groupEmitter.emit(parameters, options);
    query += this.orderEmitter.emit(options);
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
    return ` FROM "${tableName}"`;
  }

  private buildJoins(options: QueryOptions): string {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN "${join.table}"`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${join.on}`;
    }
    return out;
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length) {
      parameters.push(...options.selectParams);
    }
  }

  private buildWhereClause(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.where) return '';
    const whereArray = Array.isArray(options.where) ? options.where : [options.where];
    if (whereArray.length === 0) return '';
    const whereClauses = whereArray.map((w: WhereClause) => w.condition);
    for (const w of whereArray) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }

  private buildGroupByHaving(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.groupBy) return '';
    const groupBy: GroupByClause = Array.isArray(options.groupBy) 
      ? { columns: options.groupBy } 
      : options.groupBy;
    let sql = ` GROUP BY ${groupBy.columns.join(', ')}`;
    if (groupBy.having) {
      sql += ` HAVING ${groupBy.having.condition}`;
      parameters.push(...groupBy.having.parameters);
    }
    return sql;
  }

  private buildOrderBy(options: QueryOptions): string {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o: any) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
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
}
