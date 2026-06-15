import { describe, expect, it } from '@jest/globals';
import { InheritanceStrategy } from '@ts-linq/types';

import { InheritanceExpander } from '../../../src/snapshot/expanders/model/InheritanceExpander';
import type { ModelTableSnapshot } from '../../../src/snapshot/model-snapshot.types';
import { col, entity, modelCtx } from './support';

describe('InheritanceExpander', () => {
  const expander = new InheritanceExpander();

  it('TPH — appends the discriminator column to the root table', () => {
    const root = entity({
      tableName: 'payments',
      hierarchy: {
        strategy: InheritanceStrategy.Tph,
        subtypes: [],
        discriminator: { columnName: 'kind', columnType: 'text' }
      }
    } as never);

    const ctx = modelCtx(root, { columns: [] });
    expander.expand(ctx);

    const disc = ctx.columns.find((c) => c.name === 'kind');
    expect(disc).toBeDefined();
    expect(disc!.type).toBe('TEXT');
    expect(disc!.nullable).toBe(true);
  });

  it('TPT — registers a per-subtype table when not already present', () => {
    const CarCtor = class Car {};
    const car = entity({
      target: CarCtor,
      tableName: 'cars',
      columns: [col({ columnName: 'doors', propertyName: 'doors', type: 'INTEGER' })]
    });
    const vehicle = entity({
      tableName: 'vehicles',
      primaryKeys: ['id'],
      columns: [col({ columnName: 'id', propertyName: 'id', type: 'INTEGER' })],
      hierarchy: { strategy: InheritanceStrategy.Tpt, subtypes: [CarCtor] }
    } as never);

    const ctx = modelCtx(vehicle, { related: [car] });
    expander.expand(ctx);

    const carsTable = ctx.tables.get('cars');
    expect(carsTable).toBeDefined();
    expect(carsTable!.columns.map((c) => c.name)).toEqual(['doors']);
  });

  it('TPC — overwrites a subtype partial table with the full (root + own) columns', () => {
    const CarCtor = class Car {};
    const car = entity({
      target: CarCtor,
      tableName: 'cars',
      columns: [col({ columnName: 'doors', propertyName: 'doors', type: 'INTEGER' })]
    });
    const vehicle = entity({
      tableName: 'vehicles',
      primaryKeys: ['id'],
      columns: [col({ columnName: 'id', propertyName: 'id', type: 'INTEGER' })],
      hierarchy: { strategy: InheritanceStrategy.Tpc, subtypes: [CarCtor] }
    } as never);

    // Seed a partial base table (as the base sweep would have).
    const tables = new Map<string, ModelTableSnapshot>([
      ['cars', { name: 'cars', columns: [], primaryKeys: [], indexes: [] }]
    ]);

    const ctx = modelCtx(vehicle, { related: [car], tables });
    expander.expand(ctx);

    const carsTable = ctx.tables.get('cars');
    expect(carsTable).toBeDefined();
    const names = carsTable!.columns.map((c) => c.name);
    expect(names).toContain('id'); // root column
    expect(names).toContain('doors'); // subtype-own column
  });
});
