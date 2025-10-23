import type { SqlParameter } from '@ts-linq/types';

enum SqlInlineValueType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Object = 'object'
}

export class SqlHelper {
  /**
   * Build a WHERE clause from a simple conditions object.
   * - null/undefined -> IS NULL
   * - array -> IN (?, ?, ...)
   * - primitive -> = ?
   * @param conditions Key/value pairs to translate into SQL.
   * @returns Object with SQL fragment and parameter list.
   */
  public static buildWhereClause(conditions: Record<string, unknown>): {
    whereClause: string;
    params: SqlParameter[];
  } {
    const clauses: string[] = [];
    const params: SqlParameter[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) {
        clauses.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        clauses.push(`${key} IN (${placeholders})`);
        for (const arrayValue of value) params.push(SqlHelper.ensureSqlParameter(arrayValue));
      } else {
        clauses.push(`${key} = ?`);
        params.push(SqlHelper.ensureSqlParameter(value));
      }
    }

    return {
      whereClause: clauses.join(' AND '),
      params
    };
  }

  /** Coerce an arbitrary value into a SqlParameter. */
  private static ensureSqlParameter(value: unknown): SqlParameter {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      value instanceof Uint8Array
    ) {
      return value as SqlParameter;
    }
    // Fallback: JSON-encode objects (including arrays) into TEXT
    try {
      return JSON.stringify(value ?? null) as unknown as SqlParameter;
    } catch {
      return String(value) as unknown as SqlParameter;
    }
  }

  /**
   * Format a value for inline usage in SQL (e.g., DEFAULT expressions).
   * Escapes quotes for strings, formats dates as ISO strings.
   */
  public static formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === SqlInlineValueType.String) {
      return `'${(value as string).replace(/'/g, "''")}'`;
    }

    if (typeof value === SqlInlineValueType.Boolean) {
      return (value as boolean) ? '1' : '0';
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    return String(value);
  }

  /** Escape an identifier like a column or table name for SQL usage. */
  public static escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /** Build an ORDER BY clause string from column/direction pairs. */
  public static buildOrderByClause(
    orderBy: Array<{ column: string; direction: 'ASC' | 'DESC' }>
  ): string {
    if (orderBy.length === 0) {
      return '';
    }

    const clauses = orderBy.map((o) => `${o.column} ${o.direction}`);
    return `ORDER BY ${clauses.join(', ')}`;
  }

  /** Build a LIMIT/OFFSET clause string. */
  public static buildLimitClause(limit?: number, offset?: number): string {
    const hasLimit = typeof limit === 'number' && limit > 0;
    const hasOffset = typeof offset === 'number' && offset >= 0;
    if (!hasLimit && !hasOffset) {
      return '';
    }

    let clause = '';
    if (hasLimit) {
      clause += `LIMIT ${limit}`;
    }
    if (hasOffset) {
      clause += (clause ? ' ' : '') + `OFFSET ${offset}`;
    }

    return clause.trim();
  }
}
