import type { ColumnMetadata } from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

import { ColumnMetadataStore } from '../../src/registry/ColumnMetadataStore';
import { EntityMetadataState } from '../../src/registry/EntityMetadataState';

class Foo {}

const col = (propertyName: string, extra: Partial<ColumnMetadata> = {}): ColumnMetadata => ({
  propertyName,
  columnName: propertyName,
  type: 'INTEGER',
  nullable: false,
  isGenerated: false,
  isVersion: false,
  ...extra
});

function newStore(): { state: EntityMetadataState; columns: ColumnMetadataStore } {
  const state = new EntityMetadataState();
  return { state, columns: new ColumnMetadataStore(state) };
}

describe('ColumnMetadataStore — builder (pending) state', () => {
  it('accumulates columns on the pending builder', () => {
    const { state, columns } = newStore();
    columns.addColumn(Foo, col('id'));
    state.finalizeEntity(Foo);

    expect(state.getFinalized(Foo)?.columns.map((c) => c.propertyName)).toEqual(['id']);
  });

  it('addPrimaryKey ignores duplicates', () => {
    const { state, columns } = newStore();
    columns.addPrimaryKey(Foo, 'id');
    columns.addPrimaryKey(Foo, 'id');
    state.finalizeEntity(Foo);

    expect(state.getFinalized(Foo)?.primaryKeys).toEqual(['id']);
  });
});

describe('ColumnMetadataStore — finalized state', () => {
  function finalizedFoo(): { state: EntityMetadataState; columns: ColumnMetadataStore } {
    const ctx = newStore();
    ctx.state.getOrCreateBuilder(Foo).setTableName('foo').addColumn(col('id'));
    ctx.state.finalizeEntity(Foo);
    return ctx;
  }

  it('addColumn appends a new column but ignores an existing property', () => {
    const { state, columns } = finalizedFoo();
    columns.addColumn(Foo, col('name'));
    columns.addColumn(Foo, col('id')); // duplicate property — ignored

    expect(state.getFinalized(Foo)?.columns.map((c) => c.propertyName)).toEqual(['id', 'name']);
  });

  it('mergeFluentColumn shallow-merges onto an existing column (fluent wins)', () => {
    const { state, columns } = finalizedFoo();
    columns.mergeFluentColumn(Foo, col('id', { nullable: true, comment: 'pk' }));

    const merged = state.getFinalized(Foo)?.columns.find((c) => c.propertyName === 'id');
    expect(merged?.nullable).toBe(true);
    expect(merged?.comment).toBe('pk');
  });

  it('setFluentPrimaryKeys replaces the whole key set', () => {
    const { state, columns } = finalizedFoo();
    columns.setFluentPrimaryKeys(Foo, ['a', 'b']);
    expect(state.getFinalized(Foo)?.primaryKeys).toEqual(['a', 'b']);
  });
});

describe('ColumnMetadataStore — column validation', () => {
  it('rejects a column with both defaultExpression and defaultValue', () => {
    const { columns } = newStore();
    expect(() =>
      columns.addColumn(Foo, col('x', { defaultExpression: 'now()', defaultValue: 1 }))
    ).toThrow(ValidationError);
  });

  it('rejects a computed column marked as generated', () => {
    const { columns } = newStore();
    expect(() => columns.addColumn(Foo, col('x', { isComputed: true, isGenerated: true }))).toThrow(
      'Computed column x cannot be marked as isGenerated'
    );
  });

  it('forces a computed column to read-only', () => {
    const { state, columns } = newStore();
    columns.addColumn(Foo, col('x', { isComputed: true }));
    state.finalizeEntity(Foo);

    const stored = state.getFinalized(Foo)?.columns.find((c) => c.propertyName === 'x') as {
      isReadOnly?: boolean;
    };
    expect(stored.isReadOnly).toBe(true);
  });
});
