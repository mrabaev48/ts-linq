import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { ComplexTypePropertyMetadata } from '@ts-linq/types';

import { ModelSnapshotBuilder } from '../src/snapshot/model-snapshot';

class Address {
  street!: string;
  city!: string;
}

class Coordinates {
  lat!: number;
  lng!: number;
}

class Customer {
  id!: number;
  name!: string;
  shippingAddress!: Address;
}

describe('ModelSnapshotBuilder — complex type flattening', () => {
  beforeEach(() => {
    MetadataStorage.reset();
  });

  afterEach(() => {
    MetadataStorage.reset();
  });

  it('flattens complex type columns into the parent table', () => {
    MetadataStorage.addEntity(Customer, 'customers');
    MetadataStorage.addPrimaryKey(Customer, 'id');
    MetadataStorage.addColumn(Customer, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    MetadataStorage.addColumn(Customer, {
      propertyName: 'name',
      columnName: 'name',
      type: 'TEXT',
      nullable: false
    });

    const complexProp: ComplexTypePropertyMetadata = {
      propertyName: 'shippingAddress',
      columnPrefix: 'shippingAddress_',
      isRequired: true,
      properties: [
        { propertyName: 'street', columnName: 'street', type: 'TEXT', nullable: false },
        { propertyName: 'city', columnName: 'city', type: 'TEXT', nullable: false }
      ],
      nested: []
    };
    MetadataStorage.getEntity(Customer)!.complexProperties = [complexProp];

    const snapshot = new ModelSnapshotBuilder().buildFromMetadata();
    const table = snapshot.tables.find((t) => t.name === 'customers')!;

    const columnNames = table.columns.map((c) => c.name);
    expect(columnNames).toContain('shippingAddress_street');
    expect(columnNames).toContain('shippingAddress_city');
  });

  it('produces correct column metadata for flattened complex columns', () => {
    MetadataStorage.addEntity(Customer, 'customers');
    MetadataStorage.addPrimaryKey(Customer, 'id');
    MetadataStorage.addColumn(Customer, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });

    const complexProp: ComplexTypePropertyMetadata = {
      propertyName: 'shippingAddress',
      columnPrefix: 'shippingAddress_',
      isRequired: false,
      properties: [{ propertyName: 'street', columnName: 'street', type: 'TEXT', nullable: false }],
      nested: []
    };
    MetadataStorage.getEntity(Customer)!.complexProperties = [complexProp];

    const snapshot = new ModelSnapshotBuilder().buildFromMetadata();
    const table = snapshot.tables.find((t) => t.name === 'customers')!;
    const col = table.columns.find((c) => c.name === 'shippingAddress_street')!;

    expect(col).toBeDefined();
    expect(col.type).toBe('TEXT');
    // When isRequired=false, the column is nullable
    expect(col.nullable).toBe(true);
    expect(col.isPrimaryKey).toBe(false);
  });

  it('flattens nested complex types with accumulated prefix', () => {
    MetadataStorage.addEntity(Customer, 'customers');
    MetadataStorage.addPrimaryKey(Customer, 'id');
    MetadataStorage.addColumn(Customer, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });

    const coordsMeta: ComplexTypePropertyMetadata = {
      propertyName: 'coords',
      columnPrefix: 'coords_',
      isRequired: true,
      properties: [
        { propertyName: 'lat', columnName: 'lat', type: 'REAL', nullable: false },
        { propertyName: 'lng', columnName: 'lng', type: 'REAL', nullable: false }
      ],
      nested: []
    };
    const addrMeta: ComplexTypePropertyMetadata = {
      propertyName: 'shippingAddress',
      columnPrefix: 'shippingAddress_',
      isRequired: true,
      properties: [],
      nested: [coordsMeta]
    };
    MetadataStorage.getEntity(Customer)!.complexProperties = [addrMeta];

    const snapshot = new ModelSnapshotBuilder().buildFromMetadata();
    const table = snapshot.tables.find((t) => t.name === 'customers')!;
    const columnNames = table.columns.map((c) => c.name);

    expect(columnNames).toContain('shippingAddress_coords_lat');
    expect(columnNames).toContain('shippingAddress_coords_lng');
  });

  it('does not create a separate table for complex types', () => {
    MetadataStorage.addEntity(Customer, 'customers');
    MetadataStorage.addPrimaryKey(Customer, 'id');
    MetadataStorage.addColumn(Customer, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });

    const complexProp: ComplexTypePropertyMetadata = {
      propertyName: 'shippingAddress',
      columnPrefix: 'shippingAddress_',
      isRequired: true,
      properties: [{ propertyName: 'street', columnName: 'street', type: 'TEXT', nullable: false }],
      nested: []
    };
    MetadataStorage.getEntity(Customer)!.complexProperties = [complexProp];

    const snapshot = new ModelSnapshotBuilder().buildFromMetadata();
    // Only one table — the owner table. No separate "Address" table.
    expect(snapshot.tables.map((t) => t.name)).toEqual(['customers']);
  });
});
