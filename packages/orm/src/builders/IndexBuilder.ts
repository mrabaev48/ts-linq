import type { IndexMetadata } from '@ts-linq/types';

import { extractPropertyNames } from './utils';

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

  /**
   * Specifies non-key columns to include in a covering index.
   * Mirrors EF Core's `IncludeProperties(...)`.
   * Supported on PostgreSQL and SQL Server; ignored on MySQL with a warning.
   */
  includeProperties(selector: (e: T) => unknown): this {
    this._idx.include = extractPropertyNames(selector);
    return this;
  }

  /**
   * Specifies per-column descending sort order.
   * `flags[i] = true` means column `i` is DESC, false means ASC.
   * Mirrors EF Core's `IsDescending(...)`.
   */
  isDescending(flags: boolean[]): this {
    this._idx.isDescending = flags;
    return this;
  }
}
