import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';
import { InheritanceStrategy } from '@ts-linq/types';

import { DiscriminatorBuilder } from '../src/builders/DiscriminatorBuilder';
import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';

class Notification {}
class EmailNotification extends Notification {}
class SmsNotification extends Notification {}

class Payment {}
class CardPayment extends Payment {}
class BankPayment extends Payment {}

describe('EntityTypeBuilder — inheritance methods', () => {
  it('hasDiscriminator returns a DiscriminatorBuilder', () => {
    const builder = new EntityTypeBuilder(Notification);
    const disc = builder.hasDiscriminator<string>('kind');

    expect(disc).toBeInstanceOf(DiscriminatorBuilder);
  });

  it('hasDiscriminator sets strategy to Tph by default', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Notification, 'notifications');
    registry.addEntity(EmailNotification, 'notifications');
    registry.addEntity(SmsNotification, 'notifications');

    const builder = new EntityTypeBuilder(Notification);
    builder
      .hasDiscriminator<string>('kind')
      .hasValue(EmailNotification, 'email')
      .hasValue(SmsNotification, 'sms');

    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Notification);
    expect(meta?.hierarchy?.strategy).toBe(InheritanceStrategy.Tph);
    expect(meta?.hierarchy?.discriminator?.columnName).toBe('kind');
  });

  it('hasDiscriminator registers hierarchyRoot on subtypes', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Notification, 'notifications');
    registry.addEntity(EmailNotification, 'notifications');
    registry.addEntity(SmsNotification, 'notifications');

    const builder = new EntityTypeBuilder(Notification);
    builder
      .hasDiscriminator<string>('kind')
      .hasValue(EmailNotification, 'email')
      .hasValue(SmsNotification, 'sms');

    builder._applyToRegistry(registry);

    expect(registry.getEntity(EmailNotification)?.hierarchyRoot).toBe(Notification);
    expect(registry.getEntity(SmsNotification)?.hierarchyRoot).toBe(Notification);
  });

  it('useTptMappingStrategy sets Tpt', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Payment, 'payments');
    registry.addEntity(CardPayment, 'card_payments');

    const builder = new EntityTypeBuilder(Payment);
    builder.useTptMappingStrategy();
    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Payment);
    expect(meta?.hierarchy?.strategy).toBe(InheritanceStrategy.Tpt);
  });

  it('useTpcMappingStrategy sets Tpc', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Payment, 'payments');

    const builder = new EntityTypeBuilder(Payment);
    builder.useTpcMappingStrategy();
    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Payment);
    expect(meta?.hierarchy?.strategy).toBe(InheritanceStrategy.Tpc);
  });

  it('useTphMappingStrategy sets Tph', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Payment, 'payments');

    const builder = new EntityTypeBuilder(Payment);
    builder.useTphMappingStrategy();
    builder._applyToRegistry(registry);

    const meta = registry.getEntity(Payment);
    expect(meta?.hierarchy?.strategy).toBe(InheritanceStrategy.Tph);
  });
});
