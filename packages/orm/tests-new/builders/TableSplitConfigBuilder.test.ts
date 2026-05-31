import { TableSplitConfigBuilder } from '../../src/builders/TableSplitConfigBuilder';

describe('TableSplitConfigBuilder (P1-25)', () => {
  it('collects property names via selectors', () => {
    type Order = { id: number; notes: string; internalRef: string };
    const builder = new TableSplitConfigBuilder<Order>();
    builder.property((o) => o.notes).property((o) => o.internalRef);
    expect(builder._build()).toEqual(['notes', 'internalRef']);
  });

  it('deduplicates repeated property registrations', () => {
    type Order = { id: number; notes: string };
    const builder = new TableSplitConfigBuilder<Order>();
    builder.property((o) => o.notes).property((o) => o.notes);
    expect(builder._build()).toEqual(['notes']);
  });

  it('returns empty array when no properties configured', () => {
    const builder = new TableSplitConfigBuilder<{ id: number }>();
    expect(builder._build()).toEqual([]);
  });

  it('supports method chaining (returns this)', () => {
    type Order = { id: number; notes: string };
    const builder = new TableSplitConfigBuilder<Order>();
    const result = builder.property((o) => o.notes);
    expect(result).toBe(builder);
  });
});
