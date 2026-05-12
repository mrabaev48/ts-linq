import type { QueryOptions, SqlParameter, GroupByClause } from '@ts-linq/types';

export class MssqlGroupEmitter {
  public emit(parameters: SqlParameter[], options: QueryOptions): string {
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
}
