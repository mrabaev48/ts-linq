import type { DiscriminatorMetadata } from '@ts-linq/types';

/**
 * Fluent builder for configuring a TPH discriminator column.
 * Mirrors EF Core's DiscriminatorBuilder<TKey>.
 *
 * @example
 * mb.entity(Payment)
 *   .hasDiscriminator<string>('kind')
 *   .hasValue(CardPayment, 'card')
 *   .hasValue(BankPayment, 'bank');
 */
export class DiscriminatorBuilder<TKey> {
  private readonly _entries: Array<{ ctor: Function; value: TKey }> = [];
  private _isComplete = true;

  constructor(
    readonly _columnName: string,
    readonly _columnType: string
  ) {}

  hasValue<TSub>(ctor: new () => TSub, value: TKey): this {
    const existing = this._entries.findIndex((e) => e.ctor === ctor);
    if (existing >= 0) {
      this._entries[existing] = { ctor, value };
    } else {
      this._entries.push({ ctor, value });
    }
    return this;
  }

  isComplete(complete = true): this {
    this._isComplete = complete;
    return this;
  }

  /** @internal */
  _buildMetadata(): DiscriminatorMetadata {
    return {
      columnName: this._columnName,
      columnType: this._columnType,
      entries: this._entries.map((e) => ({ ctor: e.ctor, value: e.value })),
      isComplete: this._isComplete
    };
  }
}
