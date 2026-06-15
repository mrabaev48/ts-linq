import { describe, expect, it } from '@jest/globals';

import { ComplexTypeExpander } from '../../../src/snapshot/expanders/model/ComplexTypeExpander';
import { col, entity, modelCtx } from './support';

describe('ComplexTypeExpander', () => {
  const expander = new ComplexTypeExpander();

  it('flattens complex properties with prefix and recurses into nested types', () => {
    const owner = entity({
      tableName: 'customers',
      complexProperties: [
        {
          columnPrefix: 'addr_',
          isRequired: true,
          properties: [col({ columnName: 'street', propertyName: 'street', nullable: true })],
          nested: [
            {
              columnPrefix: 'geo_',
              isRequired: true,
              properties: [col({ columnName: 'lat', propertyName: 'lat', type: 'REAL' })],
              nested: []
            }
          ]
        }
      ]
    } as never);

    const ctx = modelCtx(owner, { columns: [] });
    expander.expand(ctx);

    const names = ctx.columns.map((c) => c.name);
    expect(names).toContain('addr_street');
    expect(names).toContain('addr_geo_lat');
  });

  it('derives nullability from the complex isRequired flag', () => {
    const owner = entity({
      tableName: 'customers',
      complexProperties: [
        {
          columnPrefix: 'addr_',
          isRequired: false,
          properties: [col({ columnName: 'city', propertyName: 'city', nullable: false })],
          nested: []
        }
      ]
    } as never);

    const ctx = modelCtx(owner, { columns: [] });
    expander.expand(ctx);

    // isRequired === false → column becomes nullable regardless of the column's own flag.
    expect(ctx.columns[0].nullable).toBe(true);
  });
});
