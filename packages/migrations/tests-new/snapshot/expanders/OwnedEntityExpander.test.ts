import { describe, expect, it } from '@jest/globals';
import { StorageStrategy } from '@ts-linq/types';

import { OwnedEntityExpander } from '../../../src/snapshot/expanders/model/OwnedEntityExpander';
import { col, entity, modelCtx } from './support';

describe('OwnedEntityExpander', () => {
  const expander = new OwnedEntityExpander();
  const AddressCtor = class Address {};

  it('TableSplit — flattens owned columns into the owner with prefix', () => {
    const owned = entity({
      target: AddressCtor,
      tableName: 'Address',
      columns: [
        col({ columnName: 'street', propertyName: 'street' }),
        col({ columnName: 'city', propertyName: 'city' })
      ]
    });
    const order = entity({
      tableName: 'orders',
      columns: [col({ columnName: 'id', propertyName: 'id', type: 'INTEGER' })],
      ownedEntities: [
        {
          ownerPropertyName: 'shippingAddress',
          ownedType: AddressCtor,
          strategy: StorageStrategy.TableSplit,
          columnPrefix: 'shipping_'
        }
      ]
    } as never);

    const ctx = modelCtx(order, { related: [owned], columns: [] });
    expander.expand(ctx);

    expect(ctx.columns.map((c) => c.name)).toEqual(['shipping_street', 'shipping_city']);
  });

  it('Json — adds a single canonical JSONB column on the owner', () => {
    const user = entity({
      tableName: 'users',
      ownedEntities: [
        {
          ownerPropertyName: 'preferences',
          ownedType: class Preferences {},
          strategy: StorageStrategy.Json,
          jsonColumnName: 'preferences_json'
        }
      ]
    } as never);

    const ctx = modelCtx(user, { columns: [] });
    expander.expand(ctx);

    expect(ctx.columns).toEqual([
      { name: 'preferences_json', type: 'JSONB', nullable: true, isPrimaryKey: false }
    ]);
  });

  it('SeparateTable — emits a dedicated table with FK→owner PK columns', () => {
    const invoice = entity({
      tableName: 'invoices',
      primaryKeys: ['id'],
      columns: [col({ columnName: 'id', propertyName: 'id', type: 'INTEGER' })],
      ownedEntities: [
        {
          ownerPropertyName: 'lineItems',
          ownedType: class LineItem {},
          strategy: StorageStrategy.SeparateTable,
          foreignKeyColumns: ['InvoiceId']
        }
      ]
    } as never);

    const ctx = modelCtx(invoice, { columns: [] });
    expander.expand(ctx);

    const lineItems = ctx.tables.get('lineItems');
    expect(lineItems).toBeDefined();
    expect(lineItems!.primaryKeys).toEqual(['InvoiceId']);
    expect(lineItems!.columns.some((c) => c.name === 'InvoiceId' && c.isPrimaryKey)).toBe(true);
  });
});
