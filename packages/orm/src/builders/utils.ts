export function extractPropertyName<T, V>(selector: (e: T) => V): string {
  const str = selector.toString();
  const arrow = str.match(/=>\s*\w+\.(\w+)/);
  if (arrow) return arrow[1];
  const bracket = str.match(/=>\s*\w+\[['"](\w+)['"]\]/);
  if (bracket) return bracket[1];
  const ret = str.match(/return\s+\w+\.(\w+)/);
  if (ret) return ret[1];
  throw new Error(`Cannot extract property name from selector: ${str}`);
}

/**
 * Extracts one or more property names from a selector that returns a single value or an array.
 * Handles: `e => e.foo` (single) and `e => [e.foo, e.bar]` (multi-column).
 */
export function extractPropertyNames<T>(selector: (e: T) => unknown): string[] {
  const str = selector.toString();
  // Array form: e => [e.a, e.b, ...]
  const arrayMatch = str.match(/=>\s*\[([^\]]+)\]/);
  if (arrayMatch) {
    return Array.from(arrayMatch[1].matchAll(/\w+\.(\w+)/g), (m) => m[1]);
  }
  // Single property form: e => e.foo
  return [extractPropertyName(selector as (e: T) => unknown)];
}
