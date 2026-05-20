import type { SqlParameter } from '@ts-linq/types';

/**
 * Holds a parameterised SQL template created by the `sql` tagged-template function.
 * Mirrors EF Core's FormattableString interpolation safety guarantee:
 * all dynamic values are passed as bound parameters, never concatenated into SQL.
 */
export class SqlInterpolated {
  constructor(
    public readonly fragments: readonly string[],
    public readonly values: readonly unknown[]
  ) {}
}

/**
 * Tagged template helper — the TypeScript-idiomatic equivalent of EF Core's C#
 * interpolated strings. Converts template values into positional SQL parameters.
 *
 * @example
 * const id = 42;
 * const query = sql`SELECT * FROM users WHERE id = ${id}`;
 * // fragments: ['SELECT * FROM users WHERE id = ', '']
 * // values:   [42]
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlInterpolated {
  return new SqlInterpolated(Array.from(strings), values);
}

/**
 * Converts a SqlInterpolated into a `{ sql, params }` pair using `?` placeholders.
 * The dialect's numberPlaceholders step later converts `?` → `$N` / `@pN` as needed.
 */
export function interpolatedToRaw(query: SqlInterpolated): { sql: string; params: SqlParameter[] } {
  const params: SqlParameter[] = [];
  let sqlStr = query.fragments[0] ?? '';
  for (let i = 1; i < query.fragments.length; i++) {
    params.push(toSqlParam(query.values[i - 1]));
    sqlStr += '?' + query.fragments[i];
  }
  return { sql: sqlStr, params };
}

export function toSqlParam(v: unknown): SqlParameter {
  if (v === null || v === undefined) return null;
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v instanceof Date ||
    v instanceof Uint8Array
  ) {
    return v as SqlParameter;
  }
  return String(v);
}
