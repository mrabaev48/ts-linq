/**
 * AST node representing a path navigation inside a JSON column.
 * Emitted by JsonAccessRewriter when a multi-segment PropertyNode resolves
 * to a Json-strategy owned property.
 *
 * Example: `u.preferences.display.theme` becomes:
 *   { type: 'jsonPath', column: 'preferences', path: ['display', 'theme'], cast: 'text' }
 */
export interface JsonPathExpression {
  type: 'jsonPath';
  /** Physical column name on the owner table (e.g. "preferences"). */
  column: string;
  /** Remaining path segments inside the JSON value (e.g. ["display", "theme"]). */
  path: string[];
  /** Optional type cast hint for dialects that require explicit casts (e.g. Postgres ::int). */
  cast?: 'text' | 'int' | 'bool' | 'float';
}
