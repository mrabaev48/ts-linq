import type { IndexMetadata } from '@ts-linq/types';

/**
 * Fluent builder for configuring a database index.
 * Mirrors EF Core's IndexBuilder<T>.
 *
 * The index object is stored by reference in the EntityTypeBuilder's indexes
 * array, so mutations here are reflected when _applyToRegistry() runs.
 */
export class IndexBuilder<T> {
  private readonly _index: IndexMetadata;

  constructor(ctor: Function, columns: string[], indexes: IndexMetadata[]) {
    this._index = {
      name: `IX_${ctor.name}_${columns.join('_')}`,
      columns
    };
    indexes.push(this._index);
  }

  /** Mark the index as UNIQUE. */
  isUnique(unique = true): this {
    this._index.unique = unique;
    return this;
  }

  /** Add a partial-index filter expression (WHERE clause). */
  hasFilter(expression: string): this {
    this._index.where = expression;
    return this;
  }

  /** Override the auto-generated index name. */
  hasName(name: string): this {
    this._index.name = name;
    return this;
  }
}
