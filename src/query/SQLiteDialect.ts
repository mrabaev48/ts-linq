import { SqlDialect } from './SqlDialect';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { JoinClause, OrderByClause, QueryOptions, WhereClause, SqlParameter } from '../types';

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
    let query = 'SELECT ';
    if (options.distinct) query += 'DISTINCT ';
    query += options.select && options.select.length ? options.select.join(', ') : '*';
    query += ` FROM ${metadata.tableName}`;

    // JOINs
    if (options.joins && options.joins.length > 0) {
      for (const join of options.joins as JoinClause[]) {
        query += ` ${join.type} JOIN ${join.table}`;
        if (join.alias) query += ` AS ${join.alias}`;
        query += ` ON ${join.on}`;
      }
    }

    const parameters: SqlParameter[] = [];

    // WHERE
    if (options.where && options.where.length > 0) {
      const whereClauses = options.where.map((w: WhereClause) => w.condition);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      for (const where of options.where) parameters.push(...where.parameters);
    }

    // GROUP BY / HAVING
    if (options.groupBy) {
      query += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
      if (options.groupBy.having) {
        query += ` HAVING ${options.groupBy.having.condition}`;
        parameters.push(...options.groupBy.having.parameters);
      }
    }

    // ORDER BY
    if (options.orderBy && options.orderBy.length > 0) {
      const orderByClauses = options.orderBy.map(
        (o: OrderByClause) => `${o.column} ${o.direction}`
      );
      query += ` ORDER BY ${orderByClauses.join(', ')}`;
    }

    // LIMIT/OFFSET quirks
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      query += ` LIMIT ${options.limit}`;
      if (hasOffset) query += ` OFFSET ${options.offset}`;
    } else if (hasOffset) {
      query += ` LIMIT -1 OFFSET ${options.offset}`;
    }
    return { query, parameters };
  }
}
