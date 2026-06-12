import { SelectorExtractionError } from '@ts-linq/types';

import { IncludeSubquery } from './include/IncludeSubquery';

/**
 * Discriminated outcome of invoking an `include(...)` selector lambda against the include proxy.
 *
 * The include proxy returns an {@link IncludeSubquery} for every property access, so a well-formed
 * selector (`b => b.posts` or `b => b.posts.where(...).take(10)`) always yields a `subquery`. Any
 * other outcome — the lambda threw, or it returned something that is not an `IncludeSubquery`
 * (e.g. a literal or a nested-path access) — is surfaced as `error`, carrying the original error
 * object so the caller can rethrow it without re-running the selector.
 */
export type IncludeResolution =
  | { kind: 'subquery'; value: IncludeSubquery<unknown> }
  | { kind: 'error'; error: unknown };

/**
 * Drives the filtered-include `Proxy` for `include(...)` lambdas. Invokes the user selector
 * **exactly once**, captures any thrown error, and classifies the result into an
 * {@link IncludeResolution}. Stateless and SQL-free — safe to share across `Queryable` clones.
 *
 * Extracting this off `IncludeBuilder` keeps the proxy a small, independently testable unit and
 * removes the previous "re-run the lambda to surface the error" smell (the selector now runs once
 * on every path, and the original error object is preserved).
 */
export class IncludeSelectorResolver {
  /** Invoke `selector` exactly once against the include proxy and classify the outcome. */
  resolve(selector: (entity: never) => unknown): IncludeResolution {
    // The proxy returns an IncludeSubquery for any property access. A plain lambda
    // (b => b.posts) yields a non-filtered subquery; a filtered lambda
    // (b => b.posts.where(...).take(10)) yields one with the specs captured.
    const proxy = new Proxy({} as object, {
      get: (_target, prop) => new IncludeSubquery<unknown>(String(prop))
    });

    let result: unknown;
    try {
      result = selector(proxy as never);
    } catch (error) {
      // Surface the captured error directly — re-running the lambda would invoke any user
      // side effect a second time and could discard/alter the original error.
      return { kind: 'error', error };
    }

    if (result instanceof IncludeSubquery) {
      return { kind: 'subquery', value: result };
    }

    // The selector did not read a navigation property (literal return, or a nested-path access
    // whose intermediate value is not an IncludeSubquery). Fail closed with a typed error.
    return {
      kind: 'error',
      error: new SelectorExtractionError(
        'include() selector must read a single navigation property ' +
          '(e.g. `b => b.posts` or `b => b.posts.where(...)`). ' +
          'For nested paths use the string form, e.g. include("a.b").'
      )
    };
  }
}
