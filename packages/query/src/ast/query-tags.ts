/**
 * Ordered, immutable list of query tag strings attached to a query chain.
 * Each element is a single-line comment that will be prepended to the emitted SQL.
 */
export type QueryTagList = readonly string[];

/** Patterns that are forbidden inside a tag value to prevent SQL injection via comment-break. */
const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [/[\r\n]/, /\*\//];

/**
 * Error thrown when a tag value contains characters that could break SQL comment syntax
 * or inject newlines into the emitted statement.
 */
export class QueryTagError extends Error {
  constructor(tag: string, reason: string) {
    super(`Invalid query tag "${tag}": ${reason}`);
    this.name = 'QueryTagError';
  }
}

/**
 * Validate and return the tag unchanged.
 * Throws {@link QueryTagError} if the tag contains newlines or comment-break sequences.
 *
 * @param tag - The raw tag string supplied by the caller.
 * @returns The original tag string when valid.
 */
export function sanitizeTag(tag: string): string {
  if (/[\r\n]/.test(tag)) {
    throw new QueryTagError(tag, 'tag must not contain newline characters');
  }
  if (/\*\//.test(tag)) {
    throw new QueryTagError(tag, 'tag must not contain comment-break sequence (*/)');
  }
  return tag;
}
