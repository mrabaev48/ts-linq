import { type FilteredIncludeSpec, UnsupportedOperationError } from '@ts-linq/types';

/**
 * Fluent builder returned when a navigation property is accessed inside a filtered
 * `include()` lambda.  Captures where-predicates, ordering, skip, and take so the
 * IncludePlanner can apply them in-memory after fetching the related rows.
 *
 * Allowed operators (EF Core parity): where, orderBy, orderByDescending,
 * thenBy, thenByDescending, skip, take.
 * Forbidden operators: select, groupBy, join — these throw at runtime with a
 * descriptive message.
 *
 * @example
 * context.blogs.include(b => b.posts
 *   .where(p => p.isPublished)
 *   .orderByDescending(p => p.publishedAt)
 *   .take(10))
 */
export class IncludeSubquery<T> implements FilteredIncludeSpec {
  readonly propertyName: string;
  private readonly _whereFilters: ReadonlyArray<(item: T) => boolean>;
  private readonly _orderBys: ReadonlyArray<{
    selector: (item: T) => unknown;
    desc: boolean;
  }>;
  private readonly _skipCount: number | undefined;
  private readonly _takeCount: number | undefined;

  constructor(
    propertyName: string,
    whereFilters: ReadonlyArray<(item: T) => boolean> = [],
    orderBys: ReadonlyArray<{ selector: (item: T) => unknown; desc: boolean }> = [],
    skip?: number,
    take?: number
  ) {
    this.propertyName = propertyName;
    this._whereFilters = whereFilters;
    this._orderBys = orderBys;
    this._skipCount = skip;
    this._takeCount = take;
  }

  /** True when at least one filter/order/pagination operator has been applied. */
  get isFiltered(): boolean {
    return (
      this._whereFilters.length > 0 ||
      this._orderBys.length > 0 ||
      this._skipCount !== undefined ||
      this._takeCount !== undefined
    );
  }

  /** Adds a WHERE predicate applied in-memory per parent. */
  where(predicate: (item: T) => boolean): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      [...this._whereFilters, predicate],
      this._orderBys,
      this._skipCount,
      this._takeCount
    );
  }

  /** Adds an ascending ORDER BY using a property selector. */
  orderBy(selector: (item: T) => unknown): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      this._whereFilters,
      [...this._orderBys, { selector, desc: false }],
      this._skipCount,
      this._takeCount
    );
  }

  /** Adds a descending ORDER BY using a property selector. */
  orderByDescending(selector: (item: T) => unknown): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      this._whereFilters,
      [...this._orderBys, { selector, desc: true }],
      this._skipCount,
      this._takeCount
    );
  }

  /** Adds a secondary ascending ORDER BY (only valid after orderBy / orderByDescending). */
  thenBy(selector: (item: T) => unknown): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      this._whereFilters,
      [...this._orderBys, { selector, desc: false }],
      this._skipCount,
      this._takeCount
    );
  }

  /** Adds a secondary descending ORDER BY (only valid after orderBy / orderByDescending). */
  thenByDescending(selector: (item: T) => unknown): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      this._whereFilters,
      [...this._orderBys, { selector, desc: true }],
      this._skipCount,
      this._takeCount
    );
  }

  /** Skips the first N related items per parent. */
  skip(count: number): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      this._whereFilters,
      this._orderBys,
      count,
      this._takeCount
    );
  }

  /** Takes at most N related items per parent. */
  take(count: number): IncludeSubquery<T> {
    return new IncludeSubquery<T>(
      this.propertyName,
      this._whereFilters,
      this._orderBys,
      this._skipCount,
      count
    );
  }

  /** @throws Always — select is forbidden inside include(). */
  select(): never {
    throw new UnsupportedOperationError(
      "ts-linq: 'select' is not allowed inside include(). " +
        'Allowed operators: where, orderBy, orderByDescending, thenBy, thenByDescending, skip, take.'
    );
  }

  /** @throws Always — groupBy is forbidden inside include(). */
  groupBy(): never {
    throw new UnsupportedOperationError(
      "ts-linq: 'groupBy' is not allowed inside include(). " +
        'Allowed operators: where, orderBy, orderByDescending, thenBy, thenByDescending, skip, take.'
    );
  }

  /** @throws Always — join is forbidden inside include(). */
  join(): never {
    throw new UnsupportedOperationError(
      "ts-linq: 'join' is not allowed inside include(). " +
        'Allowed operators: where, orderBy, orderByDescending, thenBy, thenByDescending, skip, take.'
    );
  }

  /**
   * Applies the captured where/orderBy/skip/take to `items` in-memory.
   * Called by EntityLoader.populateFilteredRelationshipsMany for each parent entity.
   */
  applyFilter(items: unknown[]): unknown[] {
    let result = items as T[];

    for (const predicate of this._whereFilters) {
      result = result.filter(predicate);
    }

    if (this._orderBys.length > 0) {
      result = [...result].sort((a, b) => {
        for (const { selector, desc } of this._orderBys) {
          const aVal = selector(a) as string | number | boolean | null | undefined;
          const bVal = selector(b) as string | number | boolean | null | undefined;
          if (aVal == null && bVal == null) continue;
          if (aVal == null) return desc ? -1 : 1;
          if (bVal == null) return desc ? 1 : -1;
          if (aVal < bVal) return desc ? 1 : -1;
          if (aVal > bVal) return desc ? -1 : 1;
        }
        return 0;
      });
    }

    if (this._skipCount !== undefined) result = result.slice(this._skipCount);
    if (this._takeCount !== undefined) result = result.slice(0, this._takeCount);

    return result as unknown[];
  }
}

/**
 * Mapped type used in the typed `include()` overload.
 * Converts each navigation property of T into `IncludeSubquery<ElementType>`,
 * enabling type-safe chaining of where/orderBy/take inside the include lambda.
 *
 * @example
 * // b is NavigationProxy<Blog>; b.posts is IncludeSubquery<Post>
 * context.blogs.include((b: NavigationProxy<Blog>) => b.posts.where(p => p.isPublished).take(10))
 */
export type NavigationProxy<T> = {
  readonly [K in keyof T]: T[K] extends (infer U)[]
    ? IncludeSubquery<U>
    : T[K] extends object
      ? IncludeSubquery<T[K]>
      : IncludeSubquery<T[K]>;
};
