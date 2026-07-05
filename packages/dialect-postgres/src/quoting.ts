/**
 * Single source of truth for PostgreSQL SQL quoting.
 *
 * All SQL generation in this package (DML, batch, DDL, index builders) MUST route identifiers
 * through {@link quoteIdentifier} and string literals through {@link quoteStringLiteral}, rather
 * than hand-rolling `"..."`/`'...'` inline. Centralizing the escaping rules here removes the
 * identifier-break-out and literal-injection gaps that arise when the escaping logic is
 * re-derived (incorrectly) at each call site.
 */

/**
 * Quote a PostgreSQL identifier (table/column/constraint/index name), escaping embedded
 * double quotes by doubling them per the SQL standard.
 */
export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Quote a PostgreSQL string literal, escaping embedded single quotes by doubling them.
 * Use for values interpolated into SQL string-literal positions (e.g. `COMMENT ... IS '...'`).
 */
export function quoteStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
