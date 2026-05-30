import { DiscriminatorBuilder } from '../src/builders/DiscriminatorBuilder';

class Payment {}
class CardPayment extends Payment {}
class BankPayment extends Payment {}

describe('DiscriminatorBuilder', () => {
  it('registers hasValue entries', () => {
    const builder = new DiscriminatorBuilder<string>('kind', 'TEXT');
    builder.hasValue(CardPayment, 'card').hasValue(BankPayment, 'bank');

    const meta = builder._buildMetadata();

    expect(meta.columnName).toBe('kind');
    expect(meta.columnType).toBe('TEXT');
    expect(meta.entries).toHaveLength(2);
    expect(meta.entries[0]).toEqual({ ctor: CardPayment, value: 'card' });
    expect(meta.entries[1]).toEqual({ ctor: BankPayment, value: 'bank' });
  });

  it('isComplete defaults to true', () => {
    const builder = new DiscriminatorBuilder<string>('kind', 'TEXT');
    expect(builder._buildMetadata().isComplete).toBe(true);
  });

  it('isComplete(false) marks the discriminator as open', () => {
    const builder = new DiscriminatorBuilder<string>('kind', 'TEXT');
    builder.isComplete(false);
    expect(builder._buildMetadata().isComplete).toBe(false);
  });

  it('overrides duplicate ctor entry', () => {
    const builder = new DiscriminatorBuilder<string>('kind', 'TEXT');
    builder.hasValue(CardPayment, 'card').hasValue(CardPayment, 'credit_card');

    const meta = builder._buildMetadata();
    expect(meta.entries).toHaveLength(1);
    expect(meta.entries[0].value).toBe('credit_card');
  });

  it('isComplete() with no args defaults to true', () => {
    const builder = new DiscriminatorBuilder<string>('kind', 'TEXT');
    builder.isComplete(false).isComplete();
    expect(builder._buildMetadata().isComplete).toBe(true);
  });
});
