/**
 * Integration test: full round-trip for TPH / TPT / TPC inheritance.
 *
 * This test exercises:
 *   1. EntityTypeBuilder fluent API (hasDiscriminator / useTphMappingStrategy, etc.)
 *   2. MetadataRegistry wiring (hierarchy on root, hierarchyRoot on subtypes)
 *   3. Queryable.ofType() model manipulation for each strategy
 *
 * No database connection is required — we inspect the QueryModel directly.
 */
import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import { InheritanceStrategy } from '@ts-linq/types';

import { EntityTypeBuilder } from '../../../orm/src/builders/EntityTypeBuilder';
import { Queryable } from '../../../query/src/Queryable';

// ── Entity hierarchy ────────────────────────────────────────────────────────

class Notification {
  id!: number;
  createdAt!: Date;
}
class EmailNotification extends Notification {
  emailAddress!: string;
}
class SmsNotification extends Notification {
  phone!: string;
}

class Payment {
  id!: number;
  amount!: number;
}
class CardPayment extends Payment {
  cardNumber!: string;
}
class BankPayment extends Payment {
  iban!: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProvider() {
  return {
    getDialect: () => ({
      buildSelect: () => ({ query: 'SELECT 1', parameters: [] }),
      quoteIdentifier: (id: string) => `"${id.replace(/"/g, '""')}"`
    }),
    loggerRef: undefined,
    providerLabel: 'test'
  } as unknown as import('../../../core/src/DatabaseProvider').DatabaseProvider;
}

function getModel(q: Queryable<any>) {
  return (q as unknown as { _model: Record<string, unknown> })._model;
}

// ── TPH ──────────────────────────────────────────────────────────────────────

describe('Inheritance — TPH round-trip', () => {
  it('EntityTypeBuilder.hasDiscriminator wires hierarchy and ofType adds WHERE clause', () => {
    const registry = createMetadataRegistry();

    registry.addEntity(Notification, 'notifications');
    registry.addColumn(Notification, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addColumn(Notification, {
      propertyName: 'kind',
      columnName: 'kind',
      type: 'TEXT'
    });
    registry.addEntity(EmailNotification, 'notifications');
    registry.addColumn(EmailNotification, {
      propertyName: 'emailAddress',
      columnName: 'email_address',
      type: 'TEXT'
    });
    registry.addEntity(SmsNotification, 'notifications');
    registry.addColumn(SmsNotification, {
      propertyName: 'phone',
      columnName: 'phone',
      type: 'TEXT'
    });

    const builder = new EntityTypeBuilder(Notification);
    builder
      .hasDiscriminator<string>('kind')
      .hasValue(EmailNotification, 'email')
      .hasValue(SmsNotification, 'sms');
    builder._applyToRegistry(registry);

    // Verify metadata
    const rootMeta = registry.getEntity(Notification)!;
    expect(rootMeta.hierarchy?.strategy).toBe(InheritanceStrategy.Tph);
    expect(registry.getEntity(EmailNotification)?.hierarchyRoot).toBe(Notification);
    expect(registry.getEntity(SmsNotification)?.hierarchyRoot).toBe(Notification);

    // Verify ofType model manipulation
    // We need to override MetadataStorage with the registry for Queryable lookups.
    // Since Queryable uses MetadataStorage.getEntity internally, we swap the singleton.
    const { MetadataStorage } = require('../../../metadata/src/MetadataStorage');
    MetadataStorage.setDefaultRegistry(registry);

    try {
      const q = new Queryable(Notification, QueryContext.fromProvider(makeProvider()));
      const emailQ = q.ofType(EmailNotification);
      const model = getModel(emailQ);
      const where = (model.where ?? []) as Array<{ condition: string; parameters: unknown[] }>;
      expect(where.some((w) => w.condition.includes('"kind"'))).toBe(true);
    } finally {
      MetadataStorage.reset();
    }
  });
});

// ── TPT ──────────────────────────────────────────────────────────────────────

describe('Inheritance — TPT round-trip', () => {
  it('useTptMappingStrategy wires hierarchy and ofType adds INNER JOIN', () => {
    const registry = createMetadataRegistry();

    registry.addEntity(Payment, 'payments');
    registry.addColumn(Payment, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addColumn(Payment, { propertyName: 'amount', columnName: 'amount', type: 'REAL' });
    registry.addPrimaryKey(Payment, 'id');

    registry.addEntity(CardPayment, 'card_payments');
    registry.addColumn(CardPayment, {
      propertyName: 'cardNumber',
      columnName: 'card_number',
      type: 'TEXT'
    });

    registry.addEntity(BankPayment, 'bank_payments');
    registry.addColumn(BankPayment, {
      propertyName: 'iban',
      columnName: 'iban',
      type: 'TEXT'
    });

    const rootBuilder = new EntityTypeBuilder(Payment);
    rootBuilder.useTptMappingStrategy();
    rootBuilder._applyToRegistry(registry);

    // Manually wire subtypes for this test (no discriminator in TPT)
    registry.setHierarchyRoot(CardPayment, Payment);
    registry.setHierarchyRoot(BankPayment, Payment);

    const rootMeta = registry.getEntity(Payment)!;
    expect(rootMeta.hierarchy?.strategy).toBe(InheritanceStrategy.Tpt);

    const { MetadataStorage } = require('../../../metadata/src/MetadataStorage');
    MetadataStorage.setDefaultRegistry(registry);

    try {
      const q = new Queryable(Payment, QueryContext.fromProvider(makeProvider()));
      const cardQ = q.ofType(CardPayment);
      const model = getModel(cardQ);
      const joins = (model.joins ?? []) as Array<{ type: string; table: string }>;
      expect(joins.some((j) => j.type === 'INNER' && j.table === 'card_payments')).toBe(true);
    } finally {
      MetadataStorage.reset();
    }
  });
});

// ── TPC ──────────────────────────────────────────────────────────────────────

describe('Inheritance — TPC round-trip', () => {
  it('useTpcMappingStrategy wires hierarchy and ofType changes FROM table', () => {
    const registry = createMetadataRegistry();

    registry.addEntity(Payment, 'payments');
    registry.addColumn(Payment, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(Payment, 'id');

    registry.addEntity(CardPayment, 'card_payments');
    registry.addColumn(CardPayment, {
      propertyName: 'cardNumber',
      columnName: 'card_number',
      type: 'TEXT'
    });

    const rootBuilder = new EntityTypeBuilder(Payment);
    rootBuilder.useTpcMappingStrategy();
    rootBuilder._applyToRegistry(registry);

    registry.setHierarchyRoot(CardPayment, Payment);

    expect(registry.getEntity(Payment)?.hierarchy?.strategy).toBe(InheritanceStrategy.Tpc);

    const { MetadataStorage } = require('../../../metadata/src/MetadataStorage');
    MetadataStorage.setDefaultRegistry(registry);

    try {
      const q = new Queryable(Payment, QueryContext.fromProvider(makeProvider()));
      const cardQ = q.ofType(CardPayment);
      const model = getModel(cardQ);
      expect(model.from).toBe('card_payments');
    } finally {
      MetadataStorage.reset();
    }
  });
});
