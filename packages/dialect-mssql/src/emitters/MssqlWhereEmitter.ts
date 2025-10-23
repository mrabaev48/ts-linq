import type { QueryOptions, SqlParameter, WhereClause } from '@ts-linq/types';

export class MssqlWhereEmitter {
  public emit(parameters: SqlParameter[], options: QueryOptions): string {
    if (!options.where) return '';
    const whereArray = Array.isArray(options.where) ? options.where : [options.where];
    if (whereArray.length === 0) return '';
    const whereClauses = whereArray.map((w: WhereClause) => w.condition);
    for (const w of whereArray) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }
}
