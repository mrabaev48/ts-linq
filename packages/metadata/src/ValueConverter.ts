import type { ValueConverterLike } from '@ts-linq/types';

export class ValueConverter<TModel, TProvider> implements ValueConverterLike<TModel, TProvider> {
  constructor(
    public readonly toProvider: (v: TModel) => TProvider,
    public readonly fromProvider: (v: TProvider) => TModel
  ) {}
}
