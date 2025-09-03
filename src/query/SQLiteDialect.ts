import { SqlDialect } from './SqlDialect';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { JoinType, QueryOptions } from '../types';

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
  ): { query: string; parameters: any[] } {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    let query = 'SELECT ';
    if (options.distinct) query += 'DISTINCT ';
    query += options.select && options.select.length ? options.select.join(', ') : '*';
    query += ` FROM ${metadata.tableName}`;
    if ((options as any).joins) {
      for (const join of (options as any).joins as Array<{
        type: JoinType;
        table: string;
        on: string;
        alias?: string;
      }>) {
        query += ` ${join.type} JOIN ${join.table}`;
        if (join.alias) query += ` AS ${join.alias}`;
        query += ` ON ${join.on}`;
      }
    }
    const parameters: any[] = [];
    if (options.where && options.where.length > 0) {
      const whereClauses = options.where.map((w) => (w as any).condition);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      for (const where of options.where) parameters.push(...(where as any).parameters);
    }
    if (options.groupBy) {
      query += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
      if (options.groupBy.having) {
        query += ` HAVING ${(options.groupBy.having as any).condition}`;
        parameters.push(...(options.groupBy.having as any).parameters);
      }
    }
    if ((options as any).orderBy && (options as any).orderBy.length > 0) {
      const orderByClauses = (options as any).orderBy.map((o: any) => `${o.column} ${o.direction}`);
      query += ` ORDER BY ${orderByClauses.join(', ')}`;
    }
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
