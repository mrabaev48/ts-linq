import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import { InheritanceStrategy } from '@ts-linq/types';

import { Queryable } from '../src/Queryable';

// --- Test hierarchy classes ---
class Notification {}
class EmailNotification extends Notification {
  emailAddress!: string;
}
class SmsNotification extends Notification {
  phone!: string;
}

class Payment {}
class CardPayment extends Payment {}
class BankPayment extends Payment {}

// --- Minimal provider mock ---
function makeProvider() {
  return {
    getDialect: () => ({
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] }),
      quoteIdentifier: (id: string) => `"${id.replace(/"/g, '""')}"`
    }),
    loggerRef: undefined,
    providerLabel: 'test'
  } as unknown as import('@ts-linq/core').DatabaseProvider;
}

// --- Setup metadata for each hierarchy ---
function registerTphHierarchy() {
  MetadataStorage.addEntity(Notification, 'notifications');
  MetadataStorage.addColumn(Notification, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER'
  });
  MetadataStorage.addColumn(Notification, {
    propertyName: 'kind',
    columnName: 'kind',
    type: 'TEXT'
  });

  MetadataStorage.addEntity(EmailNotification, 'notifications');
  MetadataStorage.addColumn(EmailNotification, {
    propertyName: 'emailAddress',
    columnName: 'email_address',
    type: 'TEXT'
  });

  MetadataStorage.addEntity(SmsNotification, 'notifications');
  MetadataStorage.addColumn(SmsNotification, {
    propertyName: 'phone',
    columnName: 'phone',
    type: 'TEXT'
  });

  // Wire hierarchy
  const disc = {
    columnName: 'kind',
    columnType: 'TEXT',
    entries: [
      { ctor: EmailNotification, value: 'email' },
      { ctor: SmsNotification, value: 'sms' }
    ],
    isComplete: true
  };
  MetadataStorage.setHierarchyMetadata(Notification, {
    strategy: InheritanceStrategy.Tph,
    rootEntity: Notification,
    discriminator: disc,
    subtypes: [EmailNotification, SmsNotification]
  });
  MetadataStorage.setHierarchyRoot(EmailNotification, Notification);
  MetadataStorage.setHierarchyRoot(SmsNotification, Notification);
}

function registerTptHierarchy() {
  MetadataStorage.addEntity(Payment, 'payments');
  MetadataStorage.addColumn(Payment, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });

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

  MetadataStorage.addPrimaryKey(Payment, 'id');

  MetadataStorage.setHierarchyMetadata(Payment, {
    strategy: InheritanceStrategy.Tpt,
    rootEntity: Payment,
    subtypes: [CardPayment, BankPayment]
  });
  MetadataStorage.setHierarchyRoot(CardPayment, Payment);
  MetadataStorage.setHierarchyRoot(BankPayment, Payment);
}

describe('Queryable.ofType()', () => {
  afterEach(() => {
    MetadataStorage.clear();
  });

  describe('TPH', () => {
    beforeEach(registerTphHierarchy);

    it('returns a Queryable<EmailNotification>', () => {
      const q = new Queryable(Notification, QueryContext.fromProvider(makeProvider()));
      const sub = q.ofType(EmailNotification);
      expect(sub).toBeInstanceOf(Queryable);
    });

    it('adds WHERE clause for discriminator value', () => {
      const q = new Queryable(Notification, QueryContext.fromProvider(makeProvider()));
      const sub = q.ofType(EmailNotification);
      const model = (sub as unknown as { _model: { where?: Array<{ condition: string }> } })._model;
      expect(model.where).toBeDefined();
      expect(model.where!.length).toBeGreaterThan(0);
      expect(model.where![0].condition).toContain('"kind"');
    });

    it('preserves existing WHERE clauses', () => {
      const q = new Queryable(Notification, QueryContext.fromProvider(makeProvider()));
      // Add a where via internal model mutation for test purposes
      (
        q as unknown as { _model: { where: Array<{ condition: string; parameters: unknown[] }> } }
      )._model.where = [{ condition: '"id" > 0', parameters: [] }];

      const sub = q.ofType(SmsNotification);
      const model = (sub as unknown as { _model: { where?: Array<{ condition: string }> } })._model;
      expect(model.where!.length).toBe(2);
    });
  });

  describe('TPT', () => {
    beforeEach(registerTptHierarchy);

    it('adds INNER JOIN to the subtype table', () => {
      const q = new Queryable(Payment, QueryContext.fromProvider(makeProvider()));
      const sub = q.ofType(CardPayment);
      const model = (
        sub as unknown as { _model: { joins?: Array<{ type: string; table: string }> } }
      )._model;
      expect(model.joins).toBeDefined();
      expect(model.joins![0].type).toBe('INNER');
      expect(model.joins![0].table).toBe('card_payments');
    });
  });

  describe('TPC', () => {
    beforeEach(() => {
      MetadataStorage.addEntity(Payment, 'payments');
      MetadataStorage.addEntity(CardPayment, 'card_payments');

      MetadataStorage.setHierarchyMetadata(Payment, {
        strategy: InheritanceStrategy.Tpc,
        rootEntity: Payment,
        subtypes: [CardPayment]
      });
      MetadataStorage.setHierarchyRoot(CardPayment, Payment);
    });

    it('changes FROM table to the concrete leaf table', () => {
      const q = new Queryable(Payment, QueryContext.fromProvider(makeProvider()));
      const sub = q.ofType(CardPayment);
      const model = (sub as unknown as { _model: { from?: string } })._model;
      expect(model.from).toBe('card_payments');
    });
  });

  describe('guard: no hierarchy registered', () => {
    it('returns a queryable without modifying the model', () => {
      class Standalone {}
      MetadataStorage.addEntity(Standalone, 'standalones');
      class StandaloneSub extends Standalone {}
      MetadataStorage.addEntity(StandaloneSub, 'standalones');

      const q = new Queryable(Standalone, QueryContext.fromProvider(makeProvider()));
      const sub = q.ofType(StandaloneSub);
      expect(sub).toBeInstanceOf(Queryable);
      const model = (sub as unknown as { _model: { where?: unknown[]; joins?: unknown[] } })._model;
      expect(model.where).toBeUndefined();
      expect(model.joins).toBeUndefined();
    });
  });
});
