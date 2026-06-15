import { describe, expect, it } from '@jest/globals';

import type { TableSnapshot } from '../../../src/DiffTypes';
import { TableFragmentExpander } from '../../../src/snapshot/expanders/schema/TableFragmentExpander';
import { col, entity, schemaCtx } from './support';

describe('TableFragmentExpander', () => {
  const expander = new TableFragmentExpander();

  const product = entity({
    tableName: 'Products',
    primaryKeys: ['id'],
    columns: [
      col({ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false }),
      col({ columnName: 'description', propertyName: 'description', type: 'TEXT' })
    ],
    tableFragments: [{ tableName: 'ProductsContent', properties: ['description'] }]
  } as never);

  it('emits a fragment table containing PK columns plus its own properties', () => {
    const ctx = schemaCtx(product);
    expander.expand(ctx);

    const fragment = ctx.tables.get('ProductsContent');
    expect(fragment).toBeDefined();
    const names = fragment!.columns.map((c) => c.name).sort();
    expect(names).toEqual(['description', 'id']);
    expect(fragment!.primaryKeys).toEqual(['id']);
  });

  it('merges into an existing fragment table instead of overwriting', () => {
    const tables = new Map<string, TableSnapshot>([
      [
        'ProductsContent',
        {
          name: 'ProductsContent',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }],
          primaryKeys: ['id'],
          indexes: [],
          foreignKeys: []
        }
      ]
    ]);

    const ctx = schemaCtx(product, { tables });
    expander.expand(ctx);

    const fragment = ctx.tables.get('ProductsContent');
    expect(fragment!.columns.map((c) => c.name).sort()).toEqual(['description', 'id']);
  });
});
