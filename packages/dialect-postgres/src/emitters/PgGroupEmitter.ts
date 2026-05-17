import type { GroupByClause, QueryOptions, SqlParameter } from '@ts-linq/types';

export class PgGroupEmitter {
  public emit(parameters: SqlParameter[], options: QueryOptions): string {
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
}
