import type { QueryOptions, SqlParameter, WhereClause } from '@ts-linq/types';

/**
 * Emit a `WHERE` clause from {@link QueryOptions}.
 *
 * Stateless and dialect-agnostic: conditions are already rendered by the query layer, so the
 * clause is identical across dialects. Collected parameters are appended to `parameters` in
 * left-to-right order to keep placeholder numbering consistent with the surrounding statement.
 *
 * @param parameters - Accumulator the clause pushes its bound parameters onto.
 * @param options - Normalized query options carrying the `where` predicate(s).
 * @returns The ` WHERE ...` fragment (leading space included), or `''` when there is no predicate.
 */
export function emitWhere(parameters: SqlParameter[], options: QueryOptions): string {
  if (!options.where) return '';
  const whereArray = Array.isArray(options.where) ? options.where : [options.where];
  if (whereArray.length === 0) return '';
  const whereClauses = whereArray.map((w: WhereClause) => w.condition);
  for (const w of whereArray) parameters.push(...w.parameters);
  return ` WHERE ${whereClauses.join(' AND ')}`;
}
