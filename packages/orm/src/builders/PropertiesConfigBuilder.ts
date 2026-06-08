import type { EntityCtorRef } from '@ts-linq/types';
import type { ValueComparerLike, ValueConverterLike } from '@ts-linq/types';

export interface GlobalConverterRule {
  converter: ValueConverterLike;
  comparer?: ValueComparerLike;
}

/**
 * Configures a global value converter for all properties of a given TypeScript type.
 * Mirrors EF Core's ModelBuilder.Properties<T>().HaveConversion().
 *
 * @example
 *   mb.properties(Date).haveConversion(DateOnlyToStringConverter);
 */
export class PropertiesConfigBuilder<T> {
  constructor(
    private readonly _ctor: abstract new (...args: unknown[]) => T,
    private readonly _globalRules: Map<EntityCtorRef, GlobalConverterRule>
  ) {}

  /**
   * Register a converter for all properties whose reflected type is T.
   * Overload 1: pass a pre-built ValueConverterLike instance.
   * Overload 2: pass explicit toProvider/fromProvider functions.
   */
  haveConversion<TProvider>(
    converterOrToProvider: ValueConverterLike<T, TProvider> | ((v: T) => TProvider),
    fromProvider?: (v: TProvider) => T,
    comparer?: ValueComparerLike<T>
  ): this {
    let converter: ValueConverterLike;
    if (typeof converterOrToProvider === 'function') {
      if (!fromProvider)
        throw new Error('fromProvider is required when passing toProvider as a function');
      converter = {
        toProvider: converterOrToProvider as (v: unknown) => unknown,
        fromProvider: fromProvider as (v: unknown) => unknown
      };
    } else {
      converter = converterOrToProvider as ValueConverterLike;
    }
    this._globalRules.set(this._ctor, {
      converter,
      comparer: comparer as ValueComparerLike | undefined
    });
    return this;
  }
}
