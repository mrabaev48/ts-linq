import type { QueryOptions, SqlParameter } from '@ts-linq/core';

export class SQLiteGroupEmitter {
  public emit(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.groupBy) return '';
    let sql = '';
    if (options.groupBy.columns && options.groupBy.columns.length > 0) {
      sql += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
    }
    if (options.groupBy.having) {
      sql += ` HAVING ${options.groupBy.having.condition}`;
      if (options.groupBy.having.parameters) parameters.push(...options.groupBy.having.parameters);
    }
    return sql;
  }
}


