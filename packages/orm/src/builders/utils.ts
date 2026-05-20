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
