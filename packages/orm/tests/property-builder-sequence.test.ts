import type { ColumnMetadata } from '@ts-linq/types';
import { ValueGeneratedPolicy } from '@ts-linq/types';

import { PropertyBuilder } from '../src/builders/PropertyBuilder';

function makeBuilder<T = number>(
  propName = 'id'
): { builder: PropertyBuilder<T>; columns: Map<string, ColumnMetadata> } {
  const columns = new Map<string, ColumnMetadata>();
  const builder = new PropertyBuilder<T>(propName, columns);
  return { builder, columns };
}

describe('PropertyBuilder — useHiLo (P1-21)', () => {
  test('sets sequenceName, default blockSize and valueGeneratedPolicy', () => {
    const { builder, columns } = makeBuilder();
    builder.useHiLo('CustomerHiLo');
    const col = columns.get('id')!;
    expect(col.sequenceName).toBe('CustomerHiLo');
    expect(col.hiLoBlockSize).toBe(10);
    expect(col.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.OnAdd);
  });

  test('accepts custom blockSize', () => {
    const { builder, columns } = makeBuilder();
    builder.useHiLo('seq', { blockSize: 50 });
    expect(columns.get('id')!.hiLoBlockSize).toBe(50);
  });

  test('accepts schema', () => {
    const { builder, columns } = makeBuilder();
    builder.useHiLo('seq', { schema: 'shared' });
    expect(columns.get('id')!.sequenceSchema).toBe('shared');
  });

  test('uses default name __hilo when no name provided', () => {
    const { builder, columns } = makeBuilder();
    builder.useHiLo();
    expect(columns.get('id')!.sequenceName).toBe('__hilo');
  });

  test('returns the same builder instance (fluent)', () => {
    const { builder } = makeBuilder();
    expect(builder.useHiLo('seq')).toBe(builder);
  });
});

describe('PropertyBuilder — useSequence (P1-21)', () => {
  test('sets sequenceName and valueGeneratedPolicy', () => {
    const { builder, columns } = makeBuilder();
    builder.useSequence('ProductSeq');
    const col = columns.get('id')!;
    expect(col.sequenceName).toBe('ProductSeq');
    expect(col.valueGeneratedPolicy).toBe(ValueGeneratedPolicy.OnAdd);
    expect(col.hiLoBlockSize).toBeUndefined();
  });

  test('accepts schema option', () => {
    const { builder, columns } = makeBuilder();
    builder.useSequence('ProductSeq', { schema: 'shared' });
    expect(columns.get('id')!.sequenceSchema).toBe('shared');
  });

  test('returns the same builder instance (fluent)', () => {
    const { builder } = makeBuilder();
    expect(builder.useSequence('seq')).toBe(builder);
  });
});
