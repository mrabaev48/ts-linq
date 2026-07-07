/**
 * Format a value for inline usage in SQL (e.g. DDL `DEFAULT` expressions). Escapes single quotes in
 * strings, renders booleans as `1`/`0`, and dates as ISO strings.
 *
 * Relocated from `@ts-linq/core`'s `SqlHelper.formatValue` so the dialect packages no longer reach
 * back into core for DDL generation (dialect→core dependency-direction smell). Kept byte-for-byte
 * identical to the original.
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  return String(value);
}
