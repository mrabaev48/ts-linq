/**
 * Extract query tags from the leading SQL comment block emitted by `emitTagComments()`.
 *
 * Each `-- <tag>` line at the start of the SQL string is treated as a tag.
 * Parsing stops at the first line that does not start with `-- `.
 *
 * @example
 * parseTagsFromSql('-- dashboard\n-- File: ctrl.ts:42\nSELECT 1')
 * // → ['dashboard', 'File: ctrl.ts:42']
 *
 * parseTagsFromSql('SELECT 1')
 * // → undefined
 *
 * @param sql - The full SQL string, potentially prefixed with tag comments.
 * @returns Ordered list of tag strings, or `undefined` when no tags are present.
 */
export function parseTagsFromSql(sql: string): readonly string[] | undefined {
  const tags: string[] = [];
  const lines = sql.split('\n');
  for (const line of lines) {
    if (line.startsWith('-- ')) {
      tags.push(line.slice(3));
    } else {
      break;
    }
  }
  return tags.length > 0 ? tags : undefined;
}
