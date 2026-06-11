import type { JoinClause } from '@ts-linq/types';

/**
 * Render a JOIN's `ON` clause from a {@link JoinClause}.
 *
 * Prefers the structured `onColumns`: every identifier is quoted through the supplied
 * dialect `quoteIdentifier`, and multiple conditions are joined with ` AND `. This keeps
 * identifier quoting a dialect concern (no hardcoded ANSI `"` in the query layer).
 *
 * Falls back to the deprecated pre-rendered `on` string when no structured conditions are
 * present, preserving backward compatibility for callers that still build the string.
 *
 * @param join - The join clause to render the `ON` condition for.
 * @param quoteIdentifier - The dialect's identifier quoter.
 * @returns The `ON` condition SQL (without the leading `ON` keyword).
 */
export function renderJoinOn(
  join: JoinClause,
  quoteIdentifier: (identifier: string) => string
): string {
  if (join.onColumns && join.onColumns.length > 0) {
    return join.onColumns
      .map((c) => {
        const left = `${quoteIdentifier(c.left.table)}.${quoteIdentifier(c.left.column)}`;
        const right = `${quoteIdentifier(c.right.table)}.${quoteIdentifier(c.right.column)}`;
        return `${left} = ${right}`;
      })
      .join(' AND ');
  }
  return join.on ?? '';
}
