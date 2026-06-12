/**
 * Unit tests for {@link IncludeSelectorResolver} — the filtered-include `Proxy` driver extracted
 * from `IncludeBuilder` (refactor query/task-9).
 *
 * Contract:
 * - A selector returning an IncludeSubquery → `{ kind: 'subquery' }`.
 * - A throwing selector → `{ kind: 'error' }` carrying the *original* error object.
 * - A selector that does not read a navigation property → `{ kind: 'error' }` (typed).
 * - The selector is invoked **exactly once** on every path.
 */
import { describe, expect, it } from '@jest/globals';
import { SelectorExtractionError } from '@ts-linq/types';

import { IncludeSubquery } from '../src/include/IncludeSubquery';
import { IncludeSelectorResolver } from '../src/IncludeSelectorResolver';

describe('IncludeSelectorResolver.resolve', () => {
  const resolver = new IncludeSelectorResolver();

  it('classifies a plain navigation access as a (non-filtered) subquery', () => {
    const resolution = resolver.resolve(
      (b: never) => (b as Record<string, IncludeSubquery<unknown>>).posts
    );
    expect(resolution.kind).toBe('subquery');
    if (resolution.kind === 'subquery') {
      expect(resolution.value).toBeInstanceOf(IncludeSubquery);
      expect(resolution.value.propertyName).toBe('posts');
      expect(resolution.value.isFiltered).toBe(false);
    }
  });

  it('classifies a filtered chain as a filtered subquery', () => {
    const resolution = resolver.resolve((b: never) =>
      (b as Record<string, IncludeSubquery<unknown>>).posts.take(5)
    );
    expect(resolution.kind).toBe('subquery');
    if (resolution.kind === 'subquery') {
      expect(resolution.value.propertyName).toBe('posts');
      expect(resolution.value.isFiltered).toBe(true);
    }
  });

  it('returns the ORIGINAL error object when the selector throws', () => {
    const original = new Error('boom from forbidden operator');
    const resolution = resolver.resolve((b: never) => {
      void (b as Record<string, IncludeSubquery<unknown>>).posts;
      throw original;
    });
    expect(resolution.kind).toBe('error');
    if (resolution.kind === 'error') {
      // Identity, not a re-run result.
      expect(resolution.error).toBe(original);
    }
  });

  it('surfaces a forbidden include operator as an error carrying the original throw', () => {
    let thrown: unknown;
    const resolution = resolver.resolve((b: never) => {
      try {
        return (b as Record<string, IncludeSubquery<unknown>>).posts.select();
      } catch (e) {
        thrown = e;
        throw e;
      }
    });
    expect(resolution.kind).toBe('error');
    if (resolution.kind === 'error') {
      expect(resolution.error).toBe(thrown);
      expect((resolution.error as Error).message).toContain(
        "'select' is not allowed inside include()"
      );
    }
  });

  it('classifies a non-navigation selector (literal) as a typed error', () => {
    const resolution = resolver.resolve(() => 42);
    expect(resolution.kind).toBe('error');
    if (resolution.kind === 'error') {
      expect(resolution.error).toBeInstanceOf(SelectorExtractionError);
    }
  });

  it('invokes the selector exactly once on the success path', () => {
    let calls = 0;
    resolver.resolve((b: never) => {
      calls += 1;
      return (b as Record<string, IncludeSubquery<unknown>>).posts;
    });
    expect(calls).toBe(1);
  });

  it('invokes the selector exactly once on the throwing path', () => {
    let calls = 0;
    resolver.resolve(() => {
      calls += 1;
      throw new Error('boom');
    });
    expect(calls).toBe(1);
  });

  it('invokes the selector exactly once on the non-navigation path', () => {
    let calls = 0;
    resolver.resolve(() => {
      calls += 1;
      return 'not-a-subquery';
    });
    expect(calls).toBe(1);
  });
});
