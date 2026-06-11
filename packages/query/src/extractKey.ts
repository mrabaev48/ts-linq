import { ValidationError } from '@ts-linq/types';

/**
 * Extracts a property key string from either a literal key or a single-property lambda selector.
 *
 * **Supported forms:**
 * - String / symbol key: `'name'`, `'userId'`
 * - Single-property lambda: `entity => entity.name`
 *
 * **Not supported (throws at runtime):**
 * - Nested-path lambdas: `entity => entity.profile.city` — use the string `'profile.city'` instead.
 * - Branching lambdas: `entity => entity.a ? entity.b : entity.c`
 * - Non-property lambdas: `entity => 42`
 *
 * Uses a Proxy to intercept property access in the lambda. Shared by the join, include and
 * ordering builders on `Queryable`.
 *
 * @throws {Error} When the lambda accesses zero properties or more than one property.
 */
export function extractKey<T>(keyOrSelector: keyof T | ((entity: T) => T[keyof T])): string {
  if (typeof keyOrSelector !== 'function') return String(keyOrSelector);
  const accessed: string[] = [];
  const proxy = new Proxy(
    {},
    {
      get(_, prop) {
        accessed.push(String(prop));
        return proxy;
      }
    }
  ) as T;
  keyOrSelector(proxy);
  if (!accessed.length) {
    throw new ValidationError('Could not extract property name from selector lambda');
  }
  if (accessed.length > 1) {
    throw new ValidationError(
      `Selector lambda accessed ${accessed.length} properties (${accessed.join(' → ')}). ` +
        `Only single-property selectors are supported (e.g. \`entity => entity.name\`). ` +
        `For nested paths use a string key (e.g. '${accessed.join('.')}').`
    );
  }
  return accessed[0];
}
