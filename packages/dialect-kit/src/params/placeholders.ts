/**
 * Renumber positional `?` markers into a dialect's indexed placeholder style.
 *
 * The visitor and batch builders emit `?` markers; each dialect renumbers them left-to-right into
 * its own 1-based indexed form by supplying a prefix: `'$'` → `$1, $2, …` (PostgreSQL), `'@p'` →
 * `@p1, @p2, …` (SQL Server). MySQL keeps `?` and does not call this.
 *
 * A string without `?` is returned unchanged, so no zero-parameter guard is required.
 */
export function numberPlaceholders(sql: string, prefix: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `${prefix}${++index}`);
}
