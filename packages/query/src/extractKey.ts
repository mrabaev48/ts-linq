import { SelectorExtractionError } from '@ts-linq/types';

/**
 * A single-property key selector: a lambda that reads exactly one top-level property of `T`.
 *
 * This is the honest selector contract enforced by {@link extractKey} at runtime. Adopting it
 * across the ordering / join / include builders makes the inferred `K` the *specific* property
 * (not the `T[keyof T]` value union) and lets nested-path misuse surface as a typed failure
 * rather than a deferred production crash.
 */
export type KeySelector<T, K extends keyof T = keyof T> = (entity: T) => T[K];

/**
 * Extracts a property key string from either a literal key or a single-property lambda selector.
 *
 * **Supported forms:**
 * - String / symbol key: `'name'`, `'userId'`
 * - Single-property lambda: `entity => entity.name`
 *
 * **Not supported (throws {@link SelectorExtractionError}):**
 * - Nested-path lambdas: `entity => entity.profile.city` — use the string `'profile.city'` instead.
 * - Branching lambdas: `entity => entity.a ? entity.b : entity.c`
 * - Non-property lambdas: `entity => 42`
 *
 * Uses a Proxy to intercept property access in the lambda. This is the single, canonical
 * key-selector extractor shared by the join, include, ordering and `setProperty` builders —
 * one Proxy implementation and one consistent (fail-closed, typed) error model.
 *
 * @throws {SelectorExtractionError} When the lambda accesses zero properties or more than one.
 */
export function extractKey<T>(keyOrSelector: keyof T | ((entity: T) => unknown)): string {
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

  // Run the selector inside a guard: the proxy itself never throws, so a throw here means the
  // lambda failed before any property access. Preserve the original cause for debuggability.
  let caught: unknown;
  try {
    keyOrSelector(proxy);
  } catch (err) {
    caught = err;
  }

  if (!accessed.length) {
    throw new SelectorExtractionError(
      'Could not extract property name from selector lambda',
      caught !== undefined ? { cause: caught } : undefined
    );
  }
  if (accessed.length > 1) {
    throw new SelectorExtractionError(
      `Selector lambda accessed ${accessed.length} properties (${accessed.join(' → ')}). ` +
        `Only single-property selectors are supported (e.g. \`entity => entity.name\`). ` +
        `For nested paths use a string key (e.g. '${accessed.join('.')}').`,
      { details: { accessed: [...accessed] } }
    );
  }
  return accessed[0];
}
