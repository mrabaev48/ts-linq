import { PropertyAccessMode } from '@ts-linq/metadata';
import type { ColumnMetadata } from '@ts-linq/types';

import { PropertyBuilder } from '../../src/builders/PropertyBuilder';

function makeBuilder<T>(propertyName: string): {
  builder: PropertyBuilder<T>;
  columns: Map<string, ColumnMetadata>;
} {
  const columns = new Map<string, ColumnMetadata>();
  const builder = new PropertyBuilder<T>(propertyName, columns);
  return { builder, columns };
}

describe('PropertyBuilder.hasField', () => {
  it('stores the fieldName in ColumnMetadata', () => {
    const { builder, columns } = makeBuilder<number>('total');
    builder.hasField('_total');
    expect(columns.get('total')!.fieldName).toBe('_total');
  });

  it('creates a Field-mode accessor when only fieldName is set', () => {
    const { builder, columns } = makeBuilder<number>('total');
    builder.hasField('_total');
    const col = columns.get('total')!;
    expect(col.accessor).toBeDefined();
    // accessor should bypass the setter
    const entity: Record<string, unknown> = {};
    const accessor = col.accessor as {
      constructionSet(e: object, v: unknown): void;
      get(e: object): unknown;
    };
    accessor.constructionSet(entity, 42);
    expect(entity['_total']).toBe(42);
  });
});

describe('PropertyBuilder.usePropertyAccessMode', () => {
  it('stores the accessMode in ColumnMetadata', () => {
    const { builder, columns } = makeBuilder<string>('status');
    builder.usePropertyAccessMode(PropertyAccessMode.Field);
    expect(columns.get('status')!.accessMode).toBe(PropertyAccessMode.Field);
  });

  it('creates an accessor for Field mode', () => {
    const { builder, columns } = makeBuilder<string>('status');
    builder.usePropertyAccessMode(PropertyAccessMode.Field);
    expect(columns.get('status')!.accessor).toBeDefined();
  });

  it('removes accessor when mode is reverted to Property with no fieldName', () => {
    const { builder, columns } = makeBuilder<string>('name');
    // First set to Field, then revert to Property
    builder.usePropertyAccessMode(PropertyAccessMode.Field);
    builder.usePropertyAccessMode(PropertyAccessMode.Property);
    // accessor is cleared when mode=Property and no explicit fieldName
    expect(columns.get('name')!.accessor).toBeUndefined();
  });

  it('accepts only valid PropertyAccessMode values (type-level enforcement)', () => {
    // This is a compile-time test; runtime value is just checked structurally.
    const { builder } = makeBuilder<string>('x');
    expect(() =>
      builder.usePropertyAccessMode(PropertyAccessMode.FieldDuringConstruction)
    ).not.toThrow();
  });
});

describe('PropertyBuilder chaining: hasField + usePropertyAccessMode', () => {
  it('uses explicit fieldName when both are set', () => {
    const { builder, columns } = makeBuilder<number>('amount');
    builder.hasField('_amount').usePropertyAccessMode(PropertyAccessMode.FieldDuringConstruction);
    const col = columns.get('amount')!;
    expect(col.fieldName).toBe('_amount');
    expect(col.accessMode).toBe(PropertyAccessMode.FieldDuringConstruction);
    // constructionSet should go to _amount
    const entity: Record<string, unknown> = {};
    const accessor = col.accessor as {
      constructionSet(e: object, v: unknown): void;
      get(e: object): unknown;
    };
    accessor.constructionSet(entity, 100);
    expect(entity['_amount']).toBe(100);
  });
});
