import { renderJoinOn } from '@ts-linq/sql-visitor';
import type { QueryOptions } from '@ts-linq/types';

/**
 * Emit the `JOIN` clauses from {@link QueryOptions}.
 *
 * The only dialect-specific concern is identifier quoting, which is injected via `quote` (Strategy
 * injection) rather than held as dialect state. Structured `onColumns` are rendered through
 * {@link renderJoinOn} so both the joined table and the `ON` condition use the same quoter.
 *
 * @param options - Normalized query options carrying the `joins`.
 * @param quote - The dialect's identifier quoter (e.g. `"id"`, `[id]`, `` `id` ``).
 * @returns The ` <TYPE> JOIN ...` fragment (leading space included), or `''` when there are no joins.
 */
export function emitJoin(options: QueryOptions, quote: (identifier: string) => string): string {
  if (!options.joins || options.joins.length === 0) return '';
  let out = '';
  for (const join of options.joins) {
    out += ` ${join.type} JOIN ${quote(join.table)}`;
    if (join.alias) out += ` AS ${join.alias}`;
    out += ` ON ${renderJoinOn(join, quote)}`;
  }
  return out;
}
