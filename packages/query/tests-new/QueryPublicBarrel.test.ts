import * as query from '../src';
import * as internal from '../src/internal';

/**
 * Guards the curated public surface of `@ts-linq/query` against accidental widening
 * (refactor query/task-10).
 *
 * Only runtime *value* exports are observable via `import * as query` — type-only exports
 * (interfaces, type aliases) are erased and intentionally not asserted here. Adding or removing
 * a value export from `src/index.ts` will fail this test, forcing a deliberate decision (and a
 * changeset). Internal collaborators (`QueryBuilder`, `LruCache`) must stay off the main barrel
 * and remain reachable only through `@ts-linq/query/internal`.
 */
describe('@ts-linq/query public barrel', () => {
  const EXPECTED_VALUE_EXPORTS = [
    'CapturedQueryPlan',
    'EF',
    'IncludableQueryable',
    'IncludeResolutionError',
    'IncludeSubquery',
    'InMemorySqlCache',
    'OrderedQueryable',
    'QueryModel',
    'QuerySplittingBehavior',
    'QueryTagError',
    'Queryable',
    'STREAMING_CHUNK_SIZE',
    'SetPropertyCalls',
    'TypedOrderedQueryable',
    'TypedQueryable',
    'sanitizeTag',
    'typed'
  ];

  it('exports exactly the curated set of runtime value symbols', () => {
    const actual = Object.keys(query).sort();
    expect(actual).toEqual([...EXPECTED_VALUE_EXPORTS].sort());
  });

  it.each(['QueryBuilder', 'LruCache'])(
    'does not leak internal collaborator %s through the main barrel',
    (symbol) => {
      expect(Object.keys(query)).not.toContain(symbol);
    }
  );

  it('keeps internal collaborators reachable through @ts-linq/query/internal', () => {
    expect(internal.QueryBuilder).toBeDefined();
    expect(internal.LruCache).toBeDefined();
  });
});
