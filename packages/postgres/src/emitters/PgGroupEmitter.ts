import type { QueryOptions, SqlParameter } from '@ts-linq/core';

export class PgGroupEmitter {
  public emit(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.groupBy) return '';
    let sql = ` GROUP BY ${options.groupBy.columns.join(', ')}`;
    if (options.groupBy.having) {
      sql += ` HAVING ${options.groupBy.having.condition}`;
      parameters.push(...options.groupBy.having.parameters);
    }
    return sql;
  }
}
