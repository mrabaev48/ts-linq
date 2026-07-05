/**
 * Single source of truth for MySQL SQL quoting.
 *
 * All SQL generation in this package (DML, batch, DDL, index builders) MUST route identifiers
 * through {@link quoteIdentifier} and string literals through {@link quoteStringLiteral}, rather
 * than hand-rolling `` `...` ``/`'...'` inline. Centralizing the escaping rules here removes the
 * identifier-break-out and literal-injection gaps that arise when the escaping logic is
 * re-derived (incorrectly) at each call site.
 */

/**
 * Quote a MySQL identifier (table/column/constraint/index name), escaping embedded backticks
 * by doubling them.
 */
export function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * Quote a MySQL string literal, escaping embedded single quotes by doubling them.
 * Use for values interpolated into SQL string-literal positions (e.g. `COMMENT '...'`).
 */
export function quoteStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
