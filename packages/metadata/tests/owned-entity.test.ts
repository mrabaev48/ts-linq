import type { OwnedEntityMetadata } from '@ts-linq/types';
import { StorageStrategy } from '@ts-linq/types';

import { createMetadataRegistry } from '../src/index';

class Address {
  street!: string;
  city!: string;
}

class Preferences {
  theme!: string;
  locale!: string;
}

class LineItem {
  productId!: number;
  quantity!: number;
}

class Order {
  id!: number;
  shippingAddress?: Address;
  preferences?: Preferences;
  lineItems!: LineItem[];
}

describe('MetadataRegistry — owned entities', () => {
  it('addOwnedEntity stores metadata and getOwnedEntities retrieves it', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Order, 'orders');

    const owned: OwnedEntityMetadata = {
      ownerPropertyName: 'shippingAddress',
      ownedType: Address,
      strategy: StorageStrategy.TableSplit,
      columnPrefix: 'shipping_',
      isCollection: false
    };

    registry.addOwnedEntity(Order, owned);
    registry.addPrimaryKey(Order, 'id');

    const result = registry.getOwnedEntities(Order);
    expect(result).toHaveLength(1);
    expect(result[0].ownerPropertyName).toBe('shippingAddress');
    expect(result[0].strategy).toBe(StorageStrategy.TableSplit);
    expect(result[0].columnPrefix).toBe('shipping_');
    expect(result[0].isCollection).toBe(false);
  });

  it('stores multiple owned entities', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Order, 'orders');

    registry.addOwnedEntity(Order, {
      ownerPropertyName: 'shippingAddress',
      ownedType: Address,
      strategy: StorageStrategy.TableSplit,
      isCollection: false
    });

    registry.addOwnedEntity(Order, {
      ownerPropertyName: 'preferences',
      ownedType: Preferences,
      strategy: StorageStrategy.Json,
      jsonColumnName: 'preferences_json',
      isCollection: false
    });

    const result = registry.getOwnedEntities(Order);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.ownerPropertyName)).toEqual(
      expect.arrayContaining(['shippingAddress', 'preferences'])
    );
  });

  it('stores SeparateTable owned collection', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Order, 'orders');

    registry.addOwnedEntity(Order, {
      ownerPropertyName: 'lineItems',
      ownedType: LineItem,
      strategy: StorageStrategy.SeparateTable,
      foreignKeyColumns: ['OrderId'],
      compositeKeyColumns: ['OrderId', 'Idx'],
      isCollection: true
    });

    const result = registry.getOwnedEntities(Order);
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe(StorageStrategy.SeparateTable);
    expect(result[0].foreignKeyColumns).toEqual(['OrderId']);
    expect(result[0].isCollection).toBe(true);
  });

  it('getOwnedEntities returns empty array for entity with no owned types', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Order, 'orders');
    expect(registry.getOwnedEntities(Order)).toEqual([]);
  });

  it('ownedEntities included in EntityMetadata build()', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Order, 'orders');
    registry.addPrimaryKey(Order, 'id');
    registry.addColumn(Order, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });

    registry.addOwnedEntity(Order, {
      ownerPropertyName: 'shippingAddress',
      ownedType: Address,
      strategy: StorageStrategy.TableSplit,
      isCollection: false
    });

    const meta = registry.getEntity(Order);
    expect(meta?.ownedEntities).toHaveLength(1);
    expect(meta?.ownedEntities?.[0].ownerPropertyName).toBe('shippingAddress');
  });
});
