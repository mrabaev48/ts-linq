import { Column, createMetadataRegistry, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DbContext, ModelBuilder, OwnedNavigationBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';
import { StorageStrategy } from '@ts-linq/types';

// ── Owned value objects ──────────────────────────────────────────────────────

class Address {
  street!: string;
  city!: string;
  postalCode?: string;
}

class Preferences {
  theme!: string;
  locale!: string;
}

class LineItem {
  productId!: number;
  quantity!: number;
}

@Entity({ name: 'oe_orders' })
class OeOrder {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  customerName!: string;

  shippingAddress?: Address;
  preferences?: Preferences;
  lineItems!: LineItem[];
}

// ─── Context with owned entity configuration ─────────────────────────────────

const testRegistry = createMetadataRegistry();

class OeOrderContext extends DbContext {
  protected override onModelCreating(mb: ModelBuilder): void {
    mb.entity(OeOrder, (b) => {
      b.ownsOne(
        (o) => o.shippingAddress,
        Address,
        (addr) => {
          addr.property((a) => a.street).hasMaxLength(200);
          addr.property((a) => a.city).hasMaxLength(100);
        }
      );
      b.ownsOne(
        (o) => o.preferences,
        Preferences,
        (prefs) => {
          prefs.toJson('preferences_json');
        }
      );
      b.ownsMany(
        (o) => o.lineItems,
        LineItem,
        (li) => {
          li.hasForeignKey('OrderId');
          li.hasKey('OrderId', 'Idx');
        }
      );
    });
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Owned Entity Types — fluent configuration integration', () => {
  let provider: TestProvider;
  let ctx: OeOrderContext;

  beforeEach(() => {
    provider = new TestProvider();
    ctx = new OeOrderContext({ provider, registry: testRegistry });
  });

  it('registers ownsOne (TableSplit) metadata after finalize', () => {
    const owned = testRegistry.getOwnedEntities(OeOrder);
    const addrOwned = owned.find((o) => o.ownerPropertyName === 'shippingAddress');

    expect(addrOwned).toBeDefined();
    expect(addrOwned!.strategy).toBe(StorageStrategy.TableSplit);
    expect(addrOwned!.columnPrefix).toBe('shippingAddress_');
    expect(addrOwned!.isCollection).toBe(false);
    expect(addrOwned!.ownedType).toBe(Address);
  });

  it('registers ownsOne (Json) metadata after finalize', () => {
    const owned = testRegistry.getOwnedEntities(OeOrder);
    const prefsOwned = owned.find((o) => o.ownerPropertyName === 'preferences');

    expect(prefsOwned).toBeDefined();
    expect(prefsOwned!.strategy).toBe(StorageStrategy.Json);
    expect(prefsOwned!.jsonColumnName).toBe('preferences_json');
    expect(prefsOwned!.isCollection).toBe(false);
  });

  it('registers ownsMany (SeparateTable) metadata after finalize', () => {
    const owned = testRegistry.getOwnedEntities(OeOrder);
    const lineItemsOwned = owned.find((o) => o.ownerPropertyName === 'lineItems');

    expect(lineItemsOwned).toBeDefined();
    expect(lineItemsOwned!.strategy).toBe(StorageStrategy.SeparateTable);
    expect(lineItemsOwned!.foreignKeyColumns).toEqual(['OrderId']);
    expect(lineItemsOwned!.compositeKeyColumns).toEqual(['OrderId', 'Idx']);
    expect(lineItemsOwned!.isCollection).toBe(true);
  });

  it('OwnedNavigationBuilder.property() configures column overrides', () => {
    const builder = new OwnedNavigationBuilder<OeOrder, Address>(
      OeOrder,
      Address,
      'shippingAddress',
      false
    );
    builder.property((a) => a.street).hasMaxLength(200);
    builder.property((a) => a.city).hasMaxLength(100);

    const overrides = builder._getColumnOverrides();
    expect(overrides.get('street')?.length).toBe(200);
    expect(overrides.get('city')?.length).toBe(100);
  });
});
