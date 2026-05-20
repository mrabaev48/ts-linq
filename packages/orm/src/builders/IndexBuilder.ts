import type { IndexMetadata } from '@ts-linq/types';

export class IndexBuilder<T> {
  private readonly _idx: IndexMetadata;

  constructor(
    ctor: new () => T,
    columns: string[],
    private readonly _indexes: IndexMetadata[]
  ) {
    this._idx = {
      name: `IX_${ctor.name}_${columns.join('_')}`,
      columns,
      unique: false
    };
    _indexes.push(this._idx);
  }

  isUnique(unique = true): this {
    this._idx.unique = unique;
    return this;
  }

  hasFilter(where: string): this {
    this._idx.where = where;
    return this;
  }

  hasName(name: string): this {
    this._idx.name = name;
    return this;
  }
}
