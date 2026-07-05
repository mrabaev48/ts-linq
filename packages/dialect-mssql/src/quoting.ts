/**
 * Single source of truth for SQL Server (T-SQL) quoting.
 *
 * All SQL generation in this package (DML, batch, DDL, index builders) MUST route identifiers
 * through {@link quoteIdentifier} and string literals through {@link quoteStringLiteral}, rather
 * than hand-rolling `[...]`/`'...'` inline. This is the highest-risk dialect: several DDL builders
 * interpolate the raw table name into T-SQL string literals (`sys.tables` lookup, `sp_rename`,
 * `sp_addextendedproperty`), so centralizing single-quote escaping here closes a literal-injection
 * gap in addition to the identifier-break-out gap the other dialects share.
 */

/**
 * Quote a SQL Server identifier (table/column/constraint/index name), escaping embedded closing
 * brackets by doubling them.
 */
export function quoteIdentifier(identifier: string): string {
  return `[${identifier.replace(/]/g, ']]')}]`;
}

/**
 * Quote a SQL Server string literal, escaping embedded single quotes by doubling them.
 * Use for values interpolated into T-SQL string-literal positions (e.g. `WHERE name = '...'`,
 * `EXEC sp_rename '...'`). Callers that need a Unicode literal prepend the `N` prefix themselves.
 */
export function quoteStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
