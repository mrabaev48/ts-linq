import type { QueryOptions } from '@ts-linq/types';

/**
 * Emit an `ORDER BY` clause from {@link QueryOptions}.
 *
 * Stateless and dialect-agnostic: columns and directions are already normalized by the query
 * layer, so the clause is identical across dialects.
 *
 * @param options - Normalized query options carrying the `orderBy` clauses.
 * @returns The ` ORDER BY ...` fragment (leading space included), or `''` when there is no ordering.
 */
export function emitOrder(options: QueryOptions): string {
  if (!options.orderBy || options.orderBy.length === 0) return '';
  const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
  return ` ORDER BY ${orderByClauses.join(', ')}`;
}
