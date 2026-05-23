/**
 * Render an ordered list of query tags as SQL single-line comments.
 *
 * Each tag becomes one `-- <tag>` line. The result always ends with a trailing
 * newline so the concatenated SQL comment block sits cleanly above the statement.
 *
 * @example
 * emitTagComments(['dashboard-top-orders', 'File: controller.ts:42'])
 * // → "-- dashboard-top-orders\n-- File: controller.ts:42\n"
 *
 * @param tags - Ordered tag strings. Assumed to be pre-sanitized (no newlines or `*\/`).
 * @returns The comment block string, or an empty string when `tags` is empty.
 */
export function emitTagComments(tags: readonly string[]): string {
  if (tags.length === 0) return '';
  return tags.map((tag) => `-- ${tag}`).join('\n') + '\n';
}
