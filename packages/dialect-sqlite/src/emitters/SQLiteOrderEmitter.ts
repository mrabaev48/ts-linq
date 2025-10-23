import type { QueryOptions, OrderByClause } from '@ts-linq/types';

export class SQLiteOrderEmitter {
  public emit(options: QueryOptions): string {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o: OrderByClause) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
  }
}
