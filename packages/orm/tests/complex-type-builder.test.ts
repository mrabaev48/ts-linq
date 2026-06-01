import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';

import { ComplexTypeBuilder } from '../src/builders/ComplexTypeBuilder';
import { flattenComplexType, getComplexPropertyNames } from '../src/builders/flattenComplexType';
import { ModelBuilder } from '../src/ModelBuilder';

// ─── Test entities ──────────────────────────────────────────────────────────

class Coordinates {
  lat!: number;
  lng!: number;
}

class Address {
  street!: string;
  city!: string;
  postalCode!: string;
  coords?: Coordinates;
}

class Customer {
  id!: number;
  name!: string;
  shippingAddress!: Address;
  billingAddress?: Address;
}

// ─── ComplexTypeBuilder unit tests ──────────────────────────────────────────

describe('ComplexTypeBuilder', () => {
  it('builds metadata with default prefix', () => {
    const builder = new ComplexTypeBuilder<Address>('shippingAddress');
    const meta = builder._build();
    expect(meta.propertyName).toBe('shippingAddress');
    expect(meta.columnPrefix).toBe('shippingAddress_');
    expect(meta.isRequired).toBe(true);
    expect(meta.properties).toHaveLength(0);
    expect(meta.nested).toHaveLength(0);
  });

  it('respects custom column prefix', () => {
    const builder = new ComplexTypeBuilder<Address>('shippingAddress');
    builder.columnPrefix('ship_');
    const meta = builder._build();
    expect(meta.columnPrefix).toBe('ship_');
  });

  it('isOptional sets isRequired to false', () => {
    const builder = new ComplexTypeBuilder<Address>('billingAddress');
    builder.isOptional();
    const meta = builder._build();
    expect(meta.isRequired).toBe(false);
  });

  it('captures leaf property configurations', () => {
    const builder = new ComplexTypeBuilder<Address>('shippingAddress');
    builder.property((a) => a.street).hasMaxLength(200);
    builder.property((a) => a.city).hasMaxLength(100);
    const meta = builder._build();
    expect(meta.properties).toHaveLength(2);
    expect(meta.properties[0].propertyName).toBe('street');
    expect(meta.properties[0].length).toBe(200);
    expect(meta.properties[1].propertyName).toBe('city');
  });

  it('supports nested complex types', () => {
    const builder = new ComplexTypeBuilder<Address>('shippingAddress');
    builder.complexProperty(
      (a) => a.coords,
      (b) => {
        b.property((c) => c.lat);
        b.property((c) => c.lng);
      }
    );
    const meta = builder._build();
    expect(meta.nested).toHaveLength(1);
    expect(meta.nested[0].propertyName).toBe('coords');
    expect(meta.nested[0].properties).toHaveLength(2);
  });
});

// ─── flattenComplexType unit tests ──────────────────────────────────────────

describe('flattenComplexType', () => {
  it('flattens leaf columns with default prefix', () => {
    const builder = new ComplexTypeBuilder<Address>('shippingAddress');
    builder.property((a) => a.street);
    builder.property((a) => a.city);
    const meta = builder._build();
    const cols = flattenComplexType(meta);
    expect(cols).toHaveLength(2);
    expect(cols[0].propertyName).toBe('shippingAddress_street');
    expect(cols[0].columnName).toBe('shippingAddress_street');
    expect(cols[1].propertyName).toBe('shippingAddress_city');
  });

  it('flattens nested complex types with accumulated prefix', () => {
    const builder = new ComplexTypeBuilder<Address>('address');
    builder.complexProperty(
      (a) => a.coords,
      (b) => {
        b.property((c) => c.lat);
        b.property((c) => c.lng);
      }
    );
    const meta = builder._build();
    const cols = flattenComplexType(meta);
    expect(cols).toHaveLength(2);
    expect(cols[0].propertyName).toBe('address_coords_lat');
    expect(cols[1].propertyName).toBe('address_coords_lng');
  });

  it('flattens mixed leaf + nested', () => {
    const builder = new ComplexTypeBuilder<Address>('addr');
    builder.property((a) => a.street);
    builder.complexProperty(
      (a) => a.coords,
      (b) => {
        b.property((c) => c.lat);
      }
    );
    const meta = builder._build();
    const cols = flattenComplexType(meta);
    expect(cols).toHaveLength(2);
    expect(cols[0].propertyName).toBe('addr_street');
    expect(cols[1].propertyName).toBe('addr_coords_lat');
  });
});

// ─── getComplexPropertyNames unit test ──────────────────────────────────────

describe('getComplexPropertyNames', () => {
  it('returns empty set for undefined', () => {
    expect(getComplexPropertyNames(undefined).size).toBe(0);
  });

  it('returns names of top-level complex properties', () => {
    const builder = new ComplexTypeBuilder<Address>('shippingAddress');
    const names = getComplexPropertyNames([builder._build()]);
    expect(names.has('shippingAddress')).toBe(true);
  });
});

// ─── EntityTypeBuilder.complexProperty() integration ────────────────────────

describe('EntityTypeBuilder.complexProperty() via ModelBuilder', () => {
  it('registers complex property metadata', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    mb.entity<Customer>(Customer)
      .toTable('customers')
      .complexProperty(
        (c) => c.shippingAddress,
        (b) => {
          b.property((a) => a.street).hasMaxLength(200);
          b.property((a) => a.city).hasMaxLength(100);
          b.property((a) => a.postalCode).isRequired();
        }
      );
    mb._finalize();

    const meta = registry.getEntity(Customer)!;
    expect(meta.complexProperties).toHaveLength(1);
    const cp = meta.complexProperties![0];
    expect(cp.propertyName).toBe('shippingAddress');
    expect(cp.columnPrefix).toBe('shippingAddress_');
    expect(cp.isRequired).toBe(true);
    expect(cp.properties).toHaveLength(3);
  });

  it('registers optional complex property', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    mb.entity<Customer>(Customer)
      .toTable('customers')
      .complexProperty(
        (c) => c.billingAddress,
        (b) => b.isOptional()
      );
    mb._finalize();

    const meta = registry.getEntity(Customer)!;
    expect(meta.complexProperties).toHaveLength(1);
    expect(meta.complexProperties![0].isRequired).toBe(false);
  });

  it('registers two complex properties on same entity', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    mb.entity<Customer>(Customer)
      .toTable('customers')
      .complexProperty((c) => c.shippingAddress)
      .complexProperty(
        (c) => c.billingAddress,
        (b) => b.isOptional()
      );
    mb._finalize();

    const meta = registry.getEntity(Customer)!;
    expect(meta.complexProperties).toHaveLength(2);
  });
});
