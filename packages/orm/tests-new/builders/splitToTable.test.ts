import { MetadataRegistry } from '@ts-linq/metadata';

import { EntityTypeBuilder } from '../../src/builders/EntityTypeBuilder';

class Order {
  id!: number;
  total!: number;
  notes!: string;
  internalRef!: string;
}

afterEach(() => {
  // MetadataRegistry instances are isolated, no global cleanup needed.
});

describe('EntityTypeBuilder.splitToTable (P1-25)', () => {
  it('registers tableFragments on the entity metadata', () => {
    const registry = new MetadataRegistry();
    registry.addEntity(Order, 'Orders');

    const builder = new EntityTypeBuilder<Order>(Order);
    builder.splitToTable('OrdersDetails', (s) => {
      s.property((o) => o.notes);
      s.property((o) => o.internalRef);
    });

    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Order);
    expect(meta?.tableFragments).toHaveLength(1);
    expect(meta?.tableFragments![0].tableName).toBe('OrdersDetails');
    expect(meta?.tableFragments![0].properties).toEqual(['notes', 'internalRef']);
  });

  it('accumulates multiple splitToTable calls as separate fragments', () => {
    const registry = new MetadataRegistry();
    registry.addEntity(Order, 'Orders');

    const builder = new EntityTypeBuilder<Order>(Order);
    builder
      .splitToTable('OrdersDetails', (s) => s.property((o) => o.notes))
      .splitToTable('OrdersExtra', (s) => s.property((o) => o.internalRef));

    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Order);
    expect(meta?.tableFragments).toHaveLength(2);
    expect(meta?.tableFragments![0].tableName).toBe('OrdersDetails');
    expect(meta?.tableFragments![1].tableName).toBe('OrdersExtra');
  });

  it('supports optional schema parameter', () => {
    const registry = new MetadataRegistry();
    registry.addEntity(Order, 'Orders');

    const builder = new EntityTypeBuilder<Order>(Order);
    builder.splitToTable('OrdersDetails', (s) => s.property((o) => o.notes), 'dbo');

    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Order);
    expect(meta?.tableFragments![0].schema).toBe('dbo');
  });

  it('returns this for fluent chaining', () => {
    const builder = new EntityTypeBuilder<Order>(Order);
    const result = builder.splitToTable('OrdersDetails', (s) => s.property((o) => o.notes));
    expect(result).toBe(builder);
  });
});
