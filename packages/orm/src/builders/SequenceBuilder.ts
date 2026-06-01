import type { SequenceMetadata } from '@ts-linq/types';

/**
 * Fluent builder for a database sequence declared via ModelBuilder.hasSequence().
 * Mirrors EF Core's SequenceBuilder.
 *
 * @example
 *   mb.hasSequence('OrderNumbers', { schema: 'shared' })
 *     .startsAt(1000)
 *     .incrementsBy(5);
 */
export class SequenceBuilder {
  private readonly _meta: SequenceMetadata;

  constructor(name: string, options?: { schema?: string; type?: 'int' | 'bigint' }) {
    this._meta = {
      name,
      schema: options?.schema,
      type: options?.type ?? 'int'
    };
  }

  /** Sets the first value produced by the sequence. */
  startsAt(value: number): this {
    this._meta.startsAt = value;
    return this;
  }

  /** Sets the step between consecutive sequence values. */
  incrementsBy(value: number): this {
    this._meta.incrementsBy = value;
    return this;
  }

  /** Sets the minimum value the sequence can produce. */
  minValue(value: number): this {
    this._meta.minValue = value;
    return this;
  }

  /** Sets the maximum value the sequence can produce before cycling or throwing. */
  maxValue(value: number): this {
    this._meta.maxValue = value;
    return this;
  }

  /** Configures the sequence to wrap around when it reaches the boundary. */
  cyclesOn(): this {
    this._meta.cyclesOn = true;
    return this;
  }

  /** @internal */
  _getMeta(): Readonly<SequenceMetadata> {
    return this._meta;
  }
}
