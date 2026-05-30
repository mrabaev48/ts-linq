import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import { InheritanceStrategy } from '@ts-linq/types';

import { ModelSnapshotBuilder } from '../src/snapshot/model-snapshot';

class Payment {}
class CardPayment extends Payment {}
class BankPayment extends Payment {}

class Vehicle {}
class Car extends Vehicle {}
class Truck extends Vehicle {}

describe('ModelSnapshotBuilder — inheritance', () => {
  afterEach(() => {
    MetadataStorage.clear();
  });

  describe('TPH', () => {
    beforeEach(() => {
      MetadataStorage.addEntity(Payment, 'payments');
      MetadataStorage.addColumn(Payment, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
      MetadataStorage.addColumn(Payment, {
        propertyName: 'amount',
        columnName: 'amount',
        type: 'REAL'
      });
      MetadataStorage.addPrimaryKey(Payment, 'id');

      MetadataStorage.setHierarchyMetadata(Payment, {
        strategy: InheritanceStrategy.Tph,
        rootEntity: Payment,
        discriminator: {
          columnName: 'kind',
          columnType: 'TEXT',
          entries: [
            { ctor: CardPayment, value: 'card' },
            { ctor: BankPayment, value: 'bank' }
          ],
          isComplete: true
        },
        subtypes: [CardPayment, BankPayment]
      });
    });

    it('adds discriminator column to root entity table', () => {
      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      const paymentTable = snapshot.tables.find((t) => t.name === 'payments');
      expect(paymentTable).toBeDefined();

      const kindCol = paymentTable!.columns.find((c) => c.name === 'kind');
      expect(kindCol).toBeDefined();
      expect(kindCol!.type).toBe('TEXT');
      expect(kindCol!.nullable).toBe(true);
    });

    it('does not create separate subtype tables', () => {
      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      // Only the root table 'payments' should appear for TPH
      const tableNames = snapshot.tables.map((t) => t.name);
      expect(tableNames.filter((n) => n === 'payments')).toHaveLength(1);
    });
  });

  describe('TPT', () => {
    beforeEach(() => {
      MetadataStorage.addEntity(Vehicle, 'vehicles');
      MetadataStorage.addColumn(Vehicle, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
      MetadataStorage.addColumn(Vehicle, {
        propertyName: 'make',
        columnName: 'make',
        type: 'TEXT'
      });
      MetadataStorage.addPrimaryKey(Vehicle, 'id');

      MetadataStorage.addEntity(Car, 'cars');
      MetadataStorage.addColumn(Car, {
        propertyName: 'doors',
        columnName: 'doors',
        type: 'INTEGER'
      });

      MetadataStorage.addEntity(Truck, 'trucks');
      MetadataStorage.addColumn(Truck, {
        propertyName: 'payload',
        columnName: 'payload',
        type: 'REAL'
      });

      MetadataStorage.setHierarchyMetadata(Vehicle, {
        strategy: InheritanceStrategy.Tpt,
        rootEntity: Vehicle,
        subtypes: [Car, Truck]
      });
      MetadataStorage.setHierarchyRoot(Car, Vehicle);
      MetadataStorage.setHierarchyRoot(Truck, Vehicle);
    });

    it('creates separate tables for each subtype', () => {
      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      const tableNames = snapshot.tables.map((t) => t.name);
      expect(tableNames).toContain('vehicles');
      expect(tableNames).toContain('cars');
      expect(tableNames).toContain('trucks');
    });

    it('subtype table contains its own columns', () => {
      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      const carTable = snapshot.tables.find((t) => t.name === 'cars');
      expect(carTable).toBeDefined();
      expect(carTable!.columns.some((c) => c.name === 'doors')).toBe(true);
    });
  });

  describe('TPC', () => {
    beforeEach(() => {
      MetadataStorage.addEntity(Payment, 'payments');
      MetadataStorage.addColumn(Payment, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
      MetadataStorage.addColumn(Payment, {
        propertyName: 'amount',
        columnName: 'amount',
        type: 'REAL'
      });
      MetadataStorage.addPrimaryKey(Payment, 'id');

      MetadataStorage.addEntity(CardPayment, 'card_payments');
      MetadataStorage.addColumn(CardPayment, {
        propertyName: 'cardNumber',
        columnName: 'card_number',
        type: 'TEXT'
      });

      MetadataStorage.addEntity(BankPayment, 'bank_payments');
      MetadataStorage.addColumn(BankPayment, {
        propertyName: 'iban',
        columnName: 'iban',
        type: 'TEXT'
      });

      MetadataStorage.setHierarchyMetadata(Payment, {
        strategy: InheritanceStrategy.Tpc,
        rootEntity: Payment,
        subtypes: [CardPayment, BankPayment]
      });
      MetadataStorage.setHierarchyRoot(CardPayment, Payment);
      MetadataStorage.setHierarchyRoot(BankPayment, Payment);
    });

    it('creates a concrete table for each leaf with root + own columns', () => {
      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      const cardTable = snapshot.tables.find((t) => t.name === 'card_payments');
      expect(cardTable).toBeDefined();
      const colNames = cardTable!.columns.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('amount');
      expect(colNames).toContain('card_number');
    });
  });
});
