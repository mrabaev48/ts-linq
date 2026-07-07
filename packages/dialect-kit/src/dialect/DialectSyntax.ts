import type { QueryOptions } from '@ts-linq/types';

/**
 * The dialect-variable tokens injected into {@link AbstractSqlDialect}'s invariant SQL-assembly
 * algorithms (Strategy). Every concrete dialect differs from the others on exactly these axes;
 * everything else — clause ordering, parameter collection, version/concurrency/PK-WHERE logic — is
 * shared in the base class.
 *
 * Implementations must be pure and stateless: they render tokens/strings only and never touch
 * metadata or accumulate parameters.
 */
export interface DialectSyntax {
  /** Quote an identifier (table/column/alias): `"id"` (PG), `[id]` (MSSQL), `` `id` `` (MySQL). */
  quote(identifier: string): string;

  /** Quote a string literal, escaping the dialect's literal-delimiter, for literal-position interpolation. */
  quoteStringLiteral(value: string): string;

  /**
   * Renumber the positional `?` markers emitted by the base algorithm into this dialect's indexed
   * placeholder style: `$1, $2, …` (PG), `@p1, @p2, …` (MSSQL), or identity (MySQL keeps `?`).
   */
  renumberPlaceholders(sql: string): string;

  /**
   * Render the SELECT head up to (but excluding) the FROM clause:
   * `SELECT [DISTINCT ][TOP (n) ]<select-list>`. The `TOP` prefix is MSSQL-only and is derived
   * from `options.limit`/`options.offset`.
   */
  renderSelectHead(options: QueryOptions): string;

  /**
   * Render the trailing row-limiting clause (leading space included, or `''` when absent). PG/MySQL
   * emit `LIMIT`/`OFFSET`; MSSQL emits `OFFSET … ROWS FETCH NEXT … ROWS ONLY` and injects a
   * synthetic `ORDER BY (SELECT NULL)` when `hasOrderBy` is false.
   *
   * @param hasOrderBy Whether an `ORDER BY` clause was already emitted before this fragment.
   */
  renderLimitOffset(options: QueryOptions, hasOrderBy: boolean): string;

  /**
   * Separator between entries in an INSERT column/placeholder list. PostgreSQL uses `','` (no
   * space); MySQL and SQL Server use `', '`. Captured as policy to preserve byte-identical output.
   */
  readonly insertColumnSeparator: string;
}
