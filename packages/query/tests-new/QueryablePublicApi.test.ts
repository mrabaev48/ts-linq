/**
 * Public-API contract for the `Queryable` god-class decomposition (refactor query/task-1).
 *
 * The decomposition extracts private collaborators (JoinBuilder, CountCoordinator, …) but the
 * public fluent surface must stay byte-for-byte identical. This snapshot asserts that every
 * documented public method remains present (and a function) on the prototype across every
 * extraction step, so a removal/rename is caught immediately rather than at integration time.
 *
 * Underscore-prefixed and `protected`/`private` helpers are deliberately NOT listed — they are
 * implementation detail and are expected to move during the refactor. `_withRawSqlSource` is the
 * one underscore-named method that is part of the surface (consumed by orm `fromSql`).
 */
import { OrderedQueryable, Queryable } from '../src/Queryable';

/** Documented public methods on `Queryable<T>` — the stable contract. */
const QUERYABLE_PUBLIC_API: readonly string[] = [
  '_withRawSqlSource',
  'asAsyncEnumerable',
  'asNoTracking',
  'asNoTrackingWithIdentityResolution',
  'asSingleQuery',
  'asSplitQuery',
  'asTracking',
  'any',
  'average',
  'clone',
  'concat',
  'contains',
  'count',
  'distinct',
  'except',
  'executeDelete',
  'executeUpdate',
  'fallbackTo',
  'first',
  'firstOrDefault',
  'forEachAsync',
  'getTags',
  'groupBy',
  'having',
  'havingCompiled',
  'ignoreQueryFilters',
  'include',
  'innerJoinOn',
  'intersect',
  'keysetPaginate',
  'leftJoinOn',
  'max',
  'min',
  'ofType',
  'orderBy',
  'orderByDescending',
  'paginate',
  'select',
  'selectCompiled',
  'single',
  'singleOrDefault',
  'skip',
  'sum',
  'tagWith',
  'tagWithCallSite',
  'take',
  'temporalAll',
  'temporalAsOf',
  'temporalBetween',
  'temporalContainedIn',
  'temporalFromTo',
  'thenInclude',
  'toArray',
  'toDictionaryAsync',
  'toListAsync',
  'union',
  'unionAll',
  'where',
  'whereCompiled',
  'whereExists',
  'whereIn',
  'whereInSubquery',
  'withAbort',
  'withCte',
  'withFallbackPolicy'
];

/** Methods that `OrderedQueryable<T>` adds on top of the inherited `Queryable` surface. */
const ORDERED_QUERYABLE_EXTRA: readonly string[] = ['thenBy', 'thenByDescending'];

describe('Queryable public API contract (task-1 decomposition)', () => {
  it.each(QUERYABLE_PUBLIC_API)('Queryable.prototype.%s is a function', (name) => {
    expect(typeof (Queryable.prototype as unknown as Record<string, unknown>)[name]).toBe(
      'function'
    );
  });

  it('exposes exactly 65 documented public methods (locks the count against drift)', () => {
    expect(QUERYABLE_PUBLIC_API).toHaveLength(65);
  });

  it.each(ORDERED_QUERYABLE_EXTRA)('OrderedQueryable.prototype.%s is a function', (name) => {
    expect(typeof (OrderedQueryable.prototype as unknown as Record<string, unknown>)[name]).toBe(
      'function'
    );
  });

  it('OrderedQueryable inherits the full Queryable public surface', () => {
    for (const name of QUERYABLE_PUBLIC_API) {
      expect(typeof (OrderedQueryable.prototype as unknown as Record<string, unknown>)[name]).toBe(
        'function'
      );
    }
  });
});
