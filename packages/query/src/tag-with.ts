import { sanitizeTag } from './ast/query-tags';
import type { QueryModel } from './QueryModel';

/**
 * Append a validated tag string to the query model's tag list.
 * The tag will be emitted as a leading SQL comment before the statement.
 *
 * @param tag   - Single-line label to attach. Must not contain newlines or `*\/`.
 * @param model - The mutable QueryModel to annotate.
 * @throws {QueryTagError} When the tag value contains forbidden characters.
 */
export function applyTagWith(tag: string, model: QueryModel): void {
  const validated = sanitizeTag(tag);
  model.tags = model.tags ? [...model.tags, validated] : [validated];
}
