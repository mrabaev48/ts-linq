import { createMetadataRegistry } from '@ts-linq/metadata';
import { StorageStrategy } from '@ts-linq/types';

import { OwnedNavigationBuilder } from '../src/builders/OwnedNavigationBuilder';
import { ModelBuilder } from '../src/ModelBuilder';

// ─── Test entities ────────────────────────────────────────────────────────────

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
  billingAddress?: Address;
  preferences?: Preferences;
  lineItems!: LineItem[];
}

// ─── OwnedNavigationBuilder unit tests ───────────────────────────────────────

describe('OwnedNavigationBuilder', () => {
  it('defaults to TableSplit strategy for ownsOne', () => {
    const builder = new OwnedNavigationBuilder<Order, Address>(
      Order,
      Address,
      'shippingAddress',
      false
    );
    const meta = builder._buildMetadata();
    expect(meta.strategy).toBe(StorageStrategy.TableSplit);
    expect(meta.columnPrefix).toBe('shippingAddress_');
    expect(meta.isCollection).toBe(false);
  });

  it('defaults to SeparateTable strategy for ownsMany', () => {
    const builder = new OwnedNavigationBuilder<Order, LineItem>(Order, LineItem, 'lineItems', true);
    const meta = builder._buildMetadata();
    expect(meta.strategy).toBe(StorageStrategy.SeparateTable);
    expect(meta.isCollection).toBe(true);
  });

  it('toJson() sets Json strategy', () => {
    const builder = new OwnedNavigationBuilder<Order, Preferences>(
      Order,
      Preferences,
      'preferences',
      false
    );
    builder.toJson('pref_json');
    const meta = builder._buildMetadata();
    expect(meta.strategy).toBe(StorageStrategy.Json);
    expect(meta.jsonColumnName).toBe('pref_json');
  });

  it('toJson() defaults column name to property name', () => {
    const builder = new OwnedNavigationBuilder<Order, Preferences>(
      Order,
      Preferences,
      'preferences',
      false
    );
    builder.toJson();
    const meta = builder._buildMetadata();
    expect(meta.jsonColumnName).toBe('preferences');
  });

  it('hasForeignKey() sets foreignKeyColumns', () => {
    const builder = new OwnedNavigationBuilder<Order, LineItem>(Order, LineItem, 'lineItems', true);
    builder.hasForeignKey('OrderId');
    const meta = builder._buildMetadata();
    expect(meta.foreignKeyColumns).toEqual(['OrderId']);
  });

  it('hasKey() sets compositeKeyColumns', () => {
    const builder = new OwnedNavigationBuilder<Order, LineItem>(Order, LineItem, 'lineItems', true);
    builder.hasKey('OrderId', 'Idx');
    const meta = builder._buildMetadata();
    expect(meta.compositeKeyColumns).toEqual(['OrderId', 'Idx']);
  });

  it('columnPrefix() overrides default prefix', () => {
    const builder = new OwnedNavigationBuilder<Order, Address>(
      Order,
      Address,
      'shippingAddress',
      false
    );
    builder.columnPrefix('ship_');
    const meta = builder._buildMetadata();
    expect(meta.columnPrefix).toBe('ship_');
  });
});

// ─── EntityTypeBuilder integration ───────────────────────────────────────────

describe('EntityTypeBuilder.ownsOne / ownsMany', () => {
  it('ownsOne registers TableSplit owned entity via registry', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    registry.addEntity(Order, 'orders');
    registry.addColumn(Order, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(Order, 'id');

    mb.entity(Order, (b) => {
      b.ownsOne((o) => o.shippingAddress, Address);
    });

    mb._finalize();

    const owned = registry.getOwnedEntities(Order);
    expect(owned).toHaveLength(1);
    expect(owned[0].ownerPropertyName).toBe('shippingAddress');
    expect(owned[0].strategy).toBe(StorageStrategy.TableSplit);
  });

  it('ownsOne with toJson() registers Json strategy', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    registry.addEntity(Order, 'orders');
    registry.addColumn(Order, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(Order, 'id');

    mb.entity(Order, (b) => {
      b.ownsOne(
        (o) => o.preferences,
        Preferences,
        (ob) => {
          ob.toJson('prefs_json');
        }
      );
    });

    mb._finalize();

    const owned = registry.getOwnedEntities(Order);
    expect(owned).toHaveLength(1);
    expect(owned[0].strategy).toBe(StorageStrategy.Json);
    expect(owned[0].jsonColumnName).toBe('prefs_json');
  });

  it('ownsMany registers SeparateTable owned entity', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    registry.addEntity(Order, 'orders');
    registry.addColumn(Order, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(Order, 'id');

    mb.entity(Order, (b) => {
      b.ownsMany(
        (o) => o.lineItems,
        LineItem,
        (li) => {
          li.hasForeignKey('InvoiceId');
          li.hasKey('InvoiceId', 'Idx');
        }
      );
    });

    mb._finalize();

    const owned = registry.getOwnedEntities(Order);
    expect(owned).toHaveLength(1);
    expect(owned[0].strategy).toBe(StorageStrategy.SeparateTable);
    expect(owned[0].foreignKeyColumns).toEqual(['InvoiceId']);
    expect(owned[0].compositeKeyColumns).toEqual(['InvoiceId', 'Idx']);
    expect(owned[0].isCollection).toBe(true);
  });

  it('multiple ownsOne registrations on same entity', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    registry.addEntity(Order, 'orders');
    registry.addColumn(Order, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(Order, 'id');

    mb.entity(Order, (b) => {
      b.ownsOne((o) => o.shippingAddress, Address);
      b.ownsOne((o) => o.billingAddress, Address);
    });

    mb._finalize();

    const owned = registry.getOwnedEntities(Order);
    expect(owned).toHaveLength(2);
    expect(owned.map((o) => o.ownerPropertyName)).toContain('shippingAddress');
    expect(owned.map((o) => o.ownerPropertyName)).toContain('billingAddress');
  });
});
