import type { QueryOptions } from '@ts-linq/core';

export class PgOrderEmitter {
  public emit(options: QueryOptions): string {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
  }
}
