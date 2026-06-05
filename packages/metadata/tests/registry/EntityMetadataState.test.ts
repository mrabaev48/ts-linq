import { EntityMetadataState } from '../../src/registry/EntityMetadataState';

class Foo {}
class Bar {}

describe('EntityMetadataState — Template Method mutate()', () => {
  it('routes to onBuilder while the entity is still pending', () => {
    const state = new EntityMetadataState();
    const calls: string[] = [];

    state.mutate(
      Foo,
      () => calls.push('finalized'),
      () => calls.push('builder')
    );

    expect(calls).toEqual(['builder']);
  });

  it('passes the live builder to onBuilder so mutations persist', () => {
    const state = new EntityMetadataState();

    state.mutate(
      Foo,
      () => {
        throw new Error('should not hit finalized branch');
      },
      (builder) => builder.setTableName('foo_table')
    );
    state.finalizeEntity(Foo);

    expect(state.getFinalized(Foo)?.tableName).toBe('foo_table');
  });

  it('routes to onFinalized once the entity is finalized', () => {
    const state = new EntityMetadataState();
    state.getOrCreateBuilder(Foo).setTableName('foo');
    state.finalizeEntity(Foo);

    const calls: string[] = [];
    state.mutate(
      Foo,
      () => calls.push('finalized'),
      () => calls.push('builder')
    );

    expect(calls).toEqual(['finalized']);
  });

  it('mutates the finalized descriptor in place via onFinalized', () => {
    const state = new EntityMetadataState();
    state.getOrCreateBuilder(Foo).setTableName('foo');
    state.finalizeEntity(Foo);

    state.mutate(
      Foo,
      (meta) => {
        meta.tableName = 'renamed';
      },
      () => {
        throw new Error('should not hit builder branch');
      }
    );

    expect(state.getFinalized(Foo)?.tableName).toBe('renamed');
  });
});

describe('EntityMetadataState — lifecycle helpers', () => {
  it('normalizeTarget returns the same class for an un-proxied target', () => {
    const state = new EntityMetadataState();
    expect(state.normalizeTarget(Foo)).toBe(Foo);
  });

  it('hasBuilder reflects pending builders only', () => {
    const state = new EntityMetadataState();
    state.getOrCreateBuilder(Foo);

    expect(state.hasBuilder(Foo)).toBe(true);
    state.finalizeEntity(Foo);
    expect(state.hasBuilder(Foo)).toBe(false);
  });

  it('finalizeAllBuilders promotes every pending builder', () => {
    const state = new EntityMetadataState();
    state.getOrCreateBuilder(Foo).setTableName('foo');
    state.getOrCreateBuilder(Bar).setTableName('bar');

    state.finalizeAllBuilders();

    expect(
      state
        .getAllEntities()
        .map((e) => e.tableName)
        .sort()
    ).toEqual(['bar', 'foo']);
  });

  it('clearState drops finalized descriptors and pending builders', () => {
    const state = new EntityMetadataState();
    state.getOrCreateBuilder(Foo).setTableName('foo');
    state.finalizeEntity(Foo);
    state.getOrCreateBuilder(Bar);

    state.clearState();

    expect(state.getAllEntities()).toEqual([]);
    expect(state.hasBuilder(Bar)).toBe(false);
  });
});
