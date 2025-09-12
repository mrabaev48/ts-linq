import { SqlDialect } from './SqlDialect';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { QueryOptions, SqlParameter } from '../types';

/**
 * MySQL dialect for SELECT generation.
 *
 * - Uses LIMIT and OFFSET (LIMIT n OFFSET m)
 * - Leaves '?' placeholders as-is (mysql2 supports positional params)
 */
export class MysqlDialect implements SqlDialect {
  public quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }
  /**
   * Build SELECT for MySQL based on normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/joins/group/limit/offset)
   */
  public buildSelect<T>(
    entityClass: new () => T,
    options: QueryOptions
  ): { query: string; parameters: readonly SqlParameter[] } {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    let query = 'SELECT ';
    if (options.distinct) query += 'DISTINCT ';
    query += options.select && options.select.length ? options.select.join(', ') : '*';
    query += ` FROM \`${metadata.tableName}\``;
    if (options.joins && options.joins.length) {
      for (const join of options.joins) {
        query += ` ${join.type} JOIN \`${join.table}\``;
        if (join.alias) query += ` AS ${join.alias}`;
        query += ` ON ${join.on}`;
      }
    }
    const parameters: SqlParameter[] = [];
    if (options.where && options.where.length > 0) {
      const whereClauses = options.where.map((w) => w.condition);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      for (const where of options.where) parameters.push(...where.parameters);
    }
    if (options.groupBy) {
      query += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
      if (options.groupBy.having) {
        query += ` HAVING ${options.groupBy.having.condition}`;
        parameters.push(...options.groupBy.having.parameters);
      }
    }
    if (options.orderBy && options.orderBy.length > 0) {
      const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
      query += ` ORDER BY ${orderByClauses.join(', ')}`;
    }
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      query += ` LIMIT ${options.limit}`;
      if (hasOffset) query += ` OFFSET ${options.offset}`;
    } else if (hasOffset) {
      // MySQL supports OFFSET only with LIMIT; emulate with large LIMIT
      query += ` LIMIT 18446744073709551615 OFFSET ${options.offset}`;
    }
    return { query, parameters };
  }
}
