/**
 * Extracts the property name accessed in a selector arrow function.
 *
 * Supports: (e) => e.propName, e => e.propName, (e) => e['propName'],
 * and function bodies with a return statement.
 */
export function extractPropertyName<T, V>(selector: (e: T) => V): string {
  const str = selector.toString();
  // Arrow: (e) => e.propName  or  e => e.propName
  const arrow = str.match(/=>\s*\w+\.(\w+)/);
  if (arrow) return arrow[1];
  // Bracket notation: (e) => e['propName']
  const bracket = str.match(/=>\s*\w+\[['"](\w+)['"]\]/);
  if (bracket) return bracket[1];
  // Function body: return e.propName
  const ret = str.match(/return\s+\w+\.(\w+)/);
  if (ret) return ret[1];
  throw new Error(`Cannot extract property name from selector: ${str}`);
}
