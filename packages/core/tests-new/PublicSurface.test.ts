import * as core from '../src';

/**
 * Guards the curated public surface of `@ts-linq/core` against accidental widening.
 *
 * Only runtime *value* exports are observable via `import * as core` — type-only exports
 * (interfaces, type aliases) are erased and intentionally not asserted here. Adding or
 * removing a value export from `src/index.ts` will fail this test, forcing a deliberate
 * decision (and a changeset). Type-level resolvability is covered by `typecheck` /
 * downstream consumers compiling against the barrel.
 */
describe('@ts-linq/core public surface', () => {
  const EXPECTED_VALUE_EXPORTS = [
    'AnsiSavepointStrategy',
    'CachePolicy',
    'CircuitOpenError',
    'Column',
    'DatabaseProvider',
    'DdlBuilder',
    'Entity',
    'EntityCache',
    'EntityLoader',
    'EntityState',
    'ExponentialBackoffRetryPolicy',
    'FixedIntervalRetryPolicy',
    'HierarchyId',
    'InterceptionResult',
    'LAZY_LOADING_PROVIDER',
    'LAZY_LOADING_PROXY',
    'LAZY_LOADING_STATE',
    'LAZY_LOADING_TARGET',
    'LazyLoadingProxy',
    'LoadingStrategy',
    'ManyToMany',
    'ManyToOne',
    'MaxLengthOf',
    'MinLengthOf',
    'NoRetryPolicy',
    'OneToMany',
    'OneToOne',
    'PatternOf',
    'PrimaryKey',
    'ProviderConfig',
    'QueryTrackingBehavior',
    'RangeOf',
    'RequiredIfOf',
    'SqlHelper',
    'UnsupportedSequenceStrategy',
    'ValidIf',
    'ValidIfOf',
    'awaitLazyLoad',
    'createGeometryCollection',
    'createLineString',
    'createMultiLineString',
    'createMultiPoint',
    'createMultiPolygon',
    'createPoint',
    'createPolygon',
    'ctorName',
    'getCachePolicy',
    'getLazyTarget',
    'getPrometheusMetrics',
    'hydrateJson',
    'hydrateOwnedEntities',
    'hydrateTableSplit',
    'isGeometry',
    'isGeometryCollection',
    'isLazyProxy',
    'isLineString',
    'isMultiLineString',
    'isMultiPoint',
    'isMultiPolygon',
    'isPoint',
    'isPolygon',
    'startPrometheusServer'
  ];

  it('exports exactly the curated set of runtime value symbols', () => {
    const actual = Object.keys(core).sort();
    expect(actual).toEqual([...EXPECTED_VALUE_EXPORTS].sort());
  });
});
