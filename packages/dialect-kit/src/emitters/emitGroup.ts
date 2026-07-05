import type { GroupByClause, QueryOptions, SqlParameter } from '@ts-linq/types';

/**
 * Emit a `GROUP BY [... HAVING ...]` clause from {@link QueryOptions}.
 *
 * Guards against an empty column list: when no columns are present a bare, dangling ` GROUP BY `
 * would be produced, which is invalid SQL. This guard (previously only in the MSSQL emitter) is
 * now the shared, correct behavior for every dialect. `HAVING` is still emitted independently so a
 * `HAVING` without grouping columns is preserved.
 *
 * @param parameters - Accumulator the clause pushes its `HAVING` parameters onto.
 * @param options - Normalized query options carrying the `groupBy` clause.
 * @returns The ` GROUP BY ...` fragment (leading space included), or `''` when there is no grouping.
 */
export function emitGroup(parameters: SqlParameter[], options: QueryOptions): string {
  if (!options.groupBy) return '';
  const groupBy: GroupByClause = Array.isArray(options.groupBy)
    ? { columns: options.groupBy }
    : options.groupBy;
  let sql = '';
  if (groupBy.columns && groupBy.columns.length > 0) {
    sql += ` GROUP BY ${groupBy.columns.join(', ')}`;
  }
  if (groupBy.having) {
    sql += ` HAVING ${groupBy.having.condition}`;
    if (groupBy.having.parameters) parameters.push(...groupBy.having.parameters);
  }
  return sql;
}
