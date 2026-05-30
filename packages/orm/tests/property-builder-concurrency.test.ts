import type { ColumnMetadata } from '@ts-linq/types';

import { PropertyBuilder } from '../src/builders/PropertyBuilder';

describe('PropertyBuilder — concurrency tokens', () => {
  function makeBuilder(): {
    builder: PropertyBuilder<unknown>;
    columns: Map<string, ColumnMetadata>;
  } {
    const columns = new Map<string, ColumnMetadata>();
    const builder = new PropertyBuilder<unknown>('title', columns);
    return { builder, columns };
  }

  test('isConcurrencyToken() sets flag to true by default', () => {
    const { builder, columns } = makeBuilder();
    const ret = builder.isConcurrencyToken();
    expect(ret).toBe(builder);
    expect(columns.get('title')?.isConcurrencyToken).toBe(true);
  });

  test('isConcurrencyToken(false) clears flag', () => {
    const { builder, columns } = makeBuilder();
    builder.isConcurrencyToken().isConcurrencyToken(false);
    expect(columns.get('title')?.isConcurrencyToken).toBe(false);
  });

  test('isConcurrencyToken() returns this (fluent)', () => {
    const { builder } = makeBuilder();
    expect(builder.isConcurrencyToken()).toBe(builder);
  });

  test('isRowVersion() sets isVersion and isConcurrencyToken', () => {
    const { builder, columns } = makeBuilder();
    const ret = builder.isRowVersion();
    expect(ret).toBe(builder);
    const col = columns.get('title');
    expect(col?.isVersion).toBe(true);
    expect(col?.isConcurrencyToken).toBe(true);
  });
});
