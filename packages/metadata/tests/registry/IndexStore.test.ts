import type { ColumnMetadata, IndexMetadata } from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

import { ColumnMetadataStore } from '../../src/registry/ColumnMetadataStore';
import { EntityMetadataState } from '../../src/registry/EntityMetadataState';
import { IndexStore } from '../../src/registry/IndexStore';

class Foo {}

const col = (propertyName: string): ColumnMetadata => ({
  propertyName,
  columnName: propertyName,
  type: 'INTEGER',
  nullable: false,
  isGenerated: false,
  isVersion: false
});

const index = (name: string, columns: string[]): IndexMetadata => ({ name, columns });

interface Ctx {
  state: EntityMetadataState;
  columns: ColumnMetadataStore;
  indexes: IndexStore;
}

function newCtx(): Ctx {
  const state = new EntityMetadataState();
  return { state, columns: new ColumnMetadataStore(state), indexes: new IndexStore(state) };
}

/** A context whose `Foo` has a single `id` column and is still a pending builder. */
function builderCtx(): Ctx {
  const ctx = newCtx();
  ctx.columns.addColumn(Foo, col('id'));
  return ctx;
}

/** A context whose `Foo` has a single `id` column and is already finalized. */
function finalizedCtx(): Ctx {
  const ctx = newCtx();
  ctx.state.getOrCreateBuilder(Foo).setTableName('foo').addColumn(col('id'));
  ctx.state.finalizeEntity(Foo);
  return ctx;
}

// The whole point of single-source validation: identical rules in both states.
describe.each<[string, () => Ctx]>([
  ['builder state', builderCtx],
  ['finalized state', finalizedCtx]
])('IndexStore.addIndex — %s', (_label, makeCtx) => {
  it('accepts an index over a known column', () => {
    const { indexes } = makeCtx();
    expect(() => indexes.addIndex(Foo, index('ix_id', ['id']))).not.toThrow();
  });

  it('rejects a duplicate index name', () => {
    const { indexes } = makeCtx();
    indexes.addIndex(Foo, index('ix_id', ['id']));
    expect(() => indexes.addIndex(Foo, index('ix_id', ['id']))).toThrow(ValidationError);
    expect(() => indexes.addIndex(Foo, index('ix_id', ['id']))).toThrow(/Duplicate index name/);
  });

  it('rejects an index over an unknown column', () => {
    const { indexes } = makeCtx();
    expect(() => indexes.addIndex(Foo, index('ix_bad', ['ghost']))).toThrow(
      /references unknown columns: ghost/
    );
  });
});

describe('IndexStore — fluent merge & alternate keys', () => {
  it('mergeFluentIndex shallow-merges onto an existing index', () => {
    const ctx = finalizedCtx();
    ctx.indexes.addIndex(Foo, index('ix_id', ['id']));
    ctx.indexes.mergeFluentIndex(Foo, { name: 'ix_id', columns: ['id'], unique: true });

    const stored = ctx.state.getFinalized(Foo)?.indexes.find((i) => i.name === 'ix_id');
    expect(stored?.unique).toBe(true);
  });

  it('mergeFluentAlternateKey upserts by name', () => {
    const ctx = finalizedCtx();
    ctx.indexes.mergeFluentAlternateKey(Foo, { name: 'ak', columns: ['id'] });
    ctx.indexes.mergeFluentAlternateKey(Foo, { name: 'ak', columns: ['id', 'email'] });

    const keys = ctx.state.getFinalized(Foo)?.alternateKeys;
    expect(keys).toHaveLength(1);
    expect(keys?.[0].columns).toEqual(['id', 'email']);
  });
});
