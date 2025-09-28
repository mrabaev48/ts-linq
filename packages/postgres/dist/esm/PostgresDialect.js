import { MetadataStorage } from '@ts-linq/core';
/**
 * PostgreSQL implementation of SqlDialect.
 *
 * - Builds SELECT statements with optional JOIN/WHERE/GROUP BY/HAVING/ORDER BY/LIMIT/OFFSET
 * - Converts positional placeholders from '?' to PostgreSQL-style $1..$n
 * - Leaves identifier quoting to providers/metadata (table/column names are passed as-is)
 */
export class PostgresDialect {
  quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '"')}`;
  }
  /**
   * Generate a PostgreSQL SELECT query from normalized QueryOptions.
   * @param entityClass Entity constructor to resolve table name
   * @param options Normalized query options (select/where/order/group/joins/limit/offset)
   */
  buildSelect(entityClass, options) {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
    let query = 'SELECT ';
    if (options.distinct) query += 'DISTINCT ';
    query += options.select && options.select.length ? options.select.join(', ') : '*';
    // Support CTE
    if (options.cte) {
      query = `WITH ${options.cte.name} AS (${options.cte.sql}) ` + query;
    }
    query += ` FROM "${options.from ?? metadata.tableName}"`;
    if (options.joins && options.joins.length) {
      for (const join of options.joins) {
        query += ` ${join.type} JOIN "${join.table}"`;
        if (join.alias) query += ` AS ${join.alias}`;
        query += ` ON ${join.on}`;
      }
    }
    const parameters = [];
    if (options.selectParams && options.selectParams.length) {
      parameters.push(...options.selectParams);
    }
    if (options.where && options.where.length > 0) {
      const whereClauses = options.where.map((whereClause) => whereClause.condition);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      for (const whereClause of options.where) parameters.push(...whereClause.parameters);
    }
    if (options.groupBy) {
      query += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
      if (options.groupBy.having) {
        query += ` HAVING ${options.groupBy.having.condition}`;
        parameters.push(...options.groupBy.having.parameters);
      }
    }
    if (options.orderBy && options.orderBy.length > 0) {
      const orderByClauses = options.orderBy.map(
        (orderBy) => `${orderBy.column} ${orderBy.direction}`
      );
      query += ` ORDER BY ${orderByClauses.join(', ')}`;
    }
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      query += ` LIMIT ${options.limit}`;
      if (hasOffset) query += ` OFFSET ${options.offset}`;
    } else if (hasOffset) {
      // Postgres allows OFFSET without LIMIT
      query += ` OFFSET ${options.offset}`;
    }
    // Convert '?' placeholders to $1..$n (if any)
    query = this.numberPlaceholders(query, parameters.length);
    return { query, parameters };
  }
  /** Replace all '?' placeholders by $1..$n according to their order. */
  numberPlaceholders(sql, paramCount) {
    if (paramCount === 0) return sql;
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `$${index}`;
    });
  }
}
//# sourceMappingURL=PostgresDialect.js.map
