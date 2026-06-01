import { describe, expect, it, jest } from '@jest/globals';
import { StorageStrategy } from '@ts-linq/types';

import { ModelSnapshotBuilder } from '../../src/snapshot/model-snapshot';

class Address {
  street!: string;
  city!: string;
}

class Preferences {
  theme!: string;
}

class LineItem {
  productId!: number;
  quantity!: number;
}

jest.mock('@ts-linq/metadata', () => ({
  MetadataStorage: {
    getEntities: jest.fn(() => [
      {
        target: class Order {},
        tableName: 'orders',
        primaryKeys: ['id'],
        columns: [{ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false }],
        indexes: [],
        ownedEntities: [
          {
            ownerPropertyName: 'shippingAddress',
            ownedType: Address,
            strategy: StorageStrategy.TableSplit,
            columnPrefix: 'shipping_',
            isCollection: false
          }
        ]
      },
      {
        target: Address,
        tableName: 'Address',
        primaryKeys: [],
        columns: [
          { columnName: 'street', propertyName: 'street', type: 'TEXT', nullable: true },
          { columnName: 'city', propertyName: 'city', type: 'TEXT', nullable: true }
        ],
        indexes: []
      }
    ])
  }
}));

describe('ModelSnapshotBuilder — owned entities (TableSplit)', () => {
  it('inlines owned entity columns into owner table with prefix', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const ordersTable = snapshot.tables.find((t) => t.name === 'orders');
    expect(ordersTable).toBeDefined();

    const colNames = ordersTable!.columns.map((c) => c.name);
    expect(colNames).toContain('shipping_street');
    expect(colNames).toContain('shipping_city');
  });
});

describe('ModelSnapshotBuilder — owned entities (Json)', () => {
  beforeEach(() => {
    (
      jest.requireMock('@ts-linq/metadata') as {
        MetadataStorage: { getEntities: jest.Mock };
      }
    ).MetadataStorage.getEntities.mockReturnValue([
      {
        target: class User {},
        tableName: 'users',
        primaryKeys: ['id'],
        columns: [{ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false }],
        indexes: [],
        ownedEntities: [
          {
            ownerPropertyName: 'preferences',
            ownedType: Preferences,
            strategy: StorageStrategy.Json,
            jsonColumnName: 'preferences_json',
            isCollection: false
          }
        ]
      }
    ]);
  });

  it('adds a single JSON column to owner table', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const usersTable = snapshot.tables.find((t) => t.name === 'users');
    expect(usersTable).toBeDefined();

    const jsonCol = usersTable!.columns.find((c) => c.name === 'preferences_json');
    expect(jsonCol).toBeDefined();
    expect(jsonCol!.type).toBe('JSONB');
    expect(jsonCol!.nullable).toBe(true);
  });
});

describe('ModelSnapshotBuilder — owned entities (SeparateTable)', () => {
  beforeEach(() => {
    (
      jest.requireMock('@ts-linq/metadata') as {
        MetadataStorage: { getEntities: jest.Mock };
      }
    ).MetadataStorage.getEntities.mockReturnValue([
      {
        target: class Invoice {},
        tableName: 'invoices',
        primaryKeys: ['id'],
        columns: [{ columnName: 'id', propertyName: 'id', type: 'INTEGER', nullable: false }],
        indexes: [],
        ownedEntities: [
          {
            ownerPropertyName: 'lineItems',
            ownedType: LineItem,
            strategy: StorageStrategy.SeparateTable,
            foreignKeyColumns: ['InvoiceId'],
            compositeKeyColumns: ['InvoiceId', 'Idx'],
            isCollection: true
          }
        ]
      }
    ]);
  });

  it('creates a separate table entry for ownsMany', () => {
    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    // When ownedType is not separately registered, table name falls back to ownerPropertyName
    const lineItemTable = snapshot.tables.find((t) => t.name === 'lineItems');
    expect(lineItemTable).toBeDefined();
    expect(lineItemTable!.primaryKeys).toContain('InvoiceId');
  });
});
