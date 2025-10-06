import type { DatabaseProvider } from '../DatabaseProvider';
import type { PerformanceOptions, Result, GlobalFilter } from '../types';
import type { EntityLoader } from '../loading/EntityLoader';
import type { EntityCacheLike } from '../utils/EntityCache';
/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
export declare class Queryable<T> {
  private _entityClass;
  private _provider;
  private _model;
  private _fallbackPredicates;
  private _entityLoader?;
  private _entityCache?;
  private _performance?;
  private _includes;
  private _sqlBuilder;
  private static _countCache;
  private static readonly _COUNT_CACHE_MAX;
  private _externalCountCache?;
  private _abortSignal?;
  private _globalFilters?;
  private _globalFilterApplier;
  private _materializer;
  private _includePlanner;
  private _cte?;
  private _whereSignature;
  private static readonly REGEX_SINGLE_PROP;
  private static readonly REGEX_OBJECT;
  private static readonly REGEX_SIMPLE_OBJECT;
  private static readonly REGEX_PROP_IN_OBJECT;
  private static readonly REGEX_ANY_PROP;
  private static readonly PREDICATE_CACHE_MAX;
  private static _predicateSqlCache;
  private static readonly SELECTOR_CACHE_MAX;
  private static _selectorPropsCache;
  private static _keySelectorCache;
  private static _includePropCache;
  /**
   * Create a new Queryable bound to an entity type and provider.
   * @param entityClass Entity constructor.
   * @param provider Database provider used for execution.
   * @param entityLoader Optional entity loader for eager includes.
   */
  constructor(
    entityClass: new () => T,
    provider: DatabaseProvider,
    entityLoader?: EntityLoader,
    entityCache?: EntityCacheLike,
    performance?: PerformanceOptions,
    globalFilters?: GlobalFilter[]
  );
  /** Clear global count() cache (used on transaction rollback to avoid stale values). */
  static clearCountCache(): void;
  /** Create a shallow clone sharing provider/loader but copying model. */
  clone(): Queryable<T>;
  /**
   * Add INNER JOIN to the query.
   * @param otherCtor Joined entity constructor
   * @param on Predicate (a,b) => a.prop === b.prop
   * @param alias Optional alias for the joined table
   */
  innerJoin<TOther>(
    otherCtor: new () => TOther,
    on: (left: T, right: TOther) => boolean,
    alias?: string
  ): Queryable<T>;
  /**
   * Add LEFT JOIN to the query.
   * @param otherCtor Joined entity constructor
   * @param on Predicate (a,b) => a.prop === b.prop
   * @param alias Optional alias for the joined table
   */
  leftJoin<TOther>(
    otherCtor: new () => TOther,
    on: (left: T, right: TOther) => boolean,
    alias?: string
  ): Queryable<T>;
  /**
   * Adds a filter predicate to the query. If the predicate cannot be parsed
   * into SQL, it is stored and applied in-memory after fetching.
   *
   * @example
   * const cheap = await context.products.where(p => p.price < 100).toArray();
   */
  where(predicate: (entity: T) => boolean): Queryable<T>;
  /** Add EXISTS (subquery) predicate. */
  whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T>;
  /** Add IN (subquery) predicate for a column. */
  whereInSubquery<TOther>(column: keyof T & string, subquery: Queryable<TOther>): Queryable<T>;
  /** With CTE support: define a named subquery and return a Queryable bound to that CTE. */
  withCte(name: string, subquery: Queryable<unknown>): Queryable<T>;
  /**
   * Projects selected properties. Returns a new Queryable of the projected type.
   * @param selector Projection selector.
   *
   * @example
   * const names = await context.authors.select(a => a.name).toArray();
   */
  select<TResult>(selector: (entity: T) => TResult): Queryable<TResult>;
  /**
   * Adds ASC ordering by key selector.
   * @param keySelector Sort key selector.
   *
   * @example
   * const ordered = await context.books.orderBy(b => b.title).toArray();
   */
  orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T>;
  /**
   * Adds DESC ordering by key selector.
   * @param keySelector Sort key selector.
   *
   * @example
   * const latest = await context.books.orderByDescending(b => b.id).take(5).toArray();
   */
  orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T>;
  /**
   * Adds secondary ASC ordering. Must be used after orderBy() or orderByDescending().
   * @param keySelector Sort key selector for secondary sort.
   *
   * @example
   * const sorted = await context.users.orderBy(u => u.lastName).thenBy(u => u.firstName).toArray();
   */
  thenBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T>;
  /**
   * Adds secondary DESC ordering. Must be used after orderBy() or orderByDescending().
   * @param keySelector Sort key selector for secondary sort.
   *
   * @example
   * const sorted = await context.users.orderBy(u => u.lastName).thenByDescending(u => u.age).toArray();
   */
  thenByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T>;
  /** Limits the number of returned rows.
   * @example
   * const top10 = await context.products.take(10).toArray();
   */
  take(count: number): Queryable<T>;
  /** Skips given number of rows.
   * @example
   * const page2 = await context.products.orderBy(p => p.id).skip(10).take(10).toArray();
   */
  skip(count: number): Queryable<T>;
  /** Ensures distinct rows.
   * @example
   * const titles = await context.books.select(b => b.title).distinct().toArray();
   */
  distinct(): Queryable<T>;
  /** UNION with another queryable of the same entity. */
  union(other: Queryable<T>): Queryable<T>;
  /** UNION ALL with another queryable of the same entity. */
  unionAll(other: Queryable<T>): Queryable<T>;
  /**
   * Group results by selected columns.
   * @example
   * const q = context.books.groupBy(b => b.authorId);
   */
  groupBy(selector: (entity: T) => unknown): Queryable<T>;
  /**
   * Apply HAVING predicate to an existing groupBy.
   * @example
   * const q = context.books.groupBy(b => b.authorId).having(() => true);
   */
  having(predicate: (entity: T) => boolean): Queryable<T>;
  /**
   * Paginate by page number and size. Applies ORDER BY fallback if missing.
   * @example
   * const page1 = await context.books.orderBy(b => b.id).paginate(1, 20);
   */
  paginate(
    page: number,
    size: number
  ): Promise<{
    items: T[];
    total: number;
    page: number;
    size: number;
  }>;
  /**
   * Keyset pagination helper. Requires a monotonic key (e.g., id).
   * @example
   * const page = await context.books.orderBy(b => b.id).keysetPaginate('id', lastId, 20);
   */
  keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{
    items: T[];
    pageSize: number;
    nextAfter: T[TKey] | null;
  }>;
  /**
   * Adds eager-loading of a relationship using a property selector.
   * Validates the relationship against entity metadata.
   *
   * @example
   * const authors = await context.authors.include(a => a.books).where(a => a.id === 1).toArray();
   */
  include(selector: (entity: T) => unknown): Queryable<T>;
  /** Executes the query and returns materialized entities.
   * @example
   * const items = await context.products.where(p => p.stock > 0).toArray();
   */
  toArray(): Promise<T[]>;
  /** Returns the first entity or throws if none.
   * @example
   * const first = await context.books.orderBy(b => b.id).first();
   */
  first(): Promise<T>;
  /** Try-version of first without throwing exceptions. */
  tryFirst(): Promise<Result<T, Error>>;
  /** Returns the first entity or null.
   * @example
   * const maybe = await context.books.where(b => b.id > 10000).firstOrDefault();
   */
  firstOrDefault(): Promise<T | null>;
  /** Ensures exactly one result; throws if 0 or more than 1.
   * @example
   * const book = await context.books.where(b => b.id === 1).single();
   */
  single(): Promise<T>;
  /** Try-version of single without throwing exceptions. */
  trySingle(): Promise<Result<T, Error>>;
  /** Returns one or null; throws if more than 1.
   * @example
   * const maybe = await context.books.where(b => b.id === 9999).singleOrDefault();
   */
  singleOrDefault(): Promise<T | null>;
  /** Returns the number of rows that match the current query.
   * @example
   * const count = await context.products.where(p => p.price >= 100).count();
   */
  count(): Promise<number>;
  private buildCountCacheKey;
  private executeCountQuery;
  /** Returns true if at least one row matches the query.
   * @example
   * const exists = await context.products.where(p => p.name === 'Laptop').any();
   */
  any(): Promise<boolean>;
  /** Adds a SQL where clause if possible, else stores predicate for in-memory filtering. */
  private addWhereOrFallback;
  /** Applies all stored fallback predicates (runtime filters). */
  private applyFallbackPredicates;
  /** Executes provided model, maps rows to entities and applies fallback predicates. */
  private executeAndMaterialize;
  /** Extracts include property name from a lambda selector. */
  private extractIncludeProperty;
  /**
   * Extract property names from a projection selector function string.
   * Supports single property, object destructuring, and simple object literal forms.
   */
  private extractPropertiesFromSelector;
  /**
   * Extract a single property name from a key selector function string.
   * Throws if parsing fails.
   */
  private extractPropertyFromKeySelector;
  /**
   * Map a raw database row object to a new entity instance using metadata.
   * Falls back to shallow assign when no metadata is available.
   */
  private mapRowToEntity;
  private shouldUseL2Cache;
  private tryGetFromCache;
  private materializeEntity;
  private rememberInCache;
  private notifyMaterialized;
  /**
   * Convert a primitive DB value to a runtime value according to column type.
   */
  private convertValue;
  /** Attach an AbortSignal to cancel execution before hitting the provider. */
  withAbort(signal: AbortSignal): Queryable<T>;
  /** Check if all elements satisfy a condition (EF-style) */
  all(predicate: (entity: T) => boolean): Promise<boolean>;
  /** Calculate average of a numeric property (EF-style) */
  average<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number>;
  /** Calculate sum of a numeric property (EF-style) */
  sum<K extends keyof T>(selector: (entity: T) => T[K]): Promise<number>;
  /** Find minimum value of a property (EF-style) */
  min<K extends keyof T>(selector: (entity: T) => T[K]): Promise<T[K]>;
  /** Find maximum value of a property (EF-style) */
  max<K extends keyof T>(selector: (entity: T) => T[K]): Promise<T[K]>;
  /** Check if the sequence contains a specific element (EF-style) */
  contains(item: T): Promise<boolean>;
  /** Get elements that are in this sequence but not in the other (EF-style) */
  except(other: Queryable<T>): Queryable<T>;
  /** Get elements that are in both sequences (EF-style) */
  intersect(other: Queryable<T>): Queryable<T>;
  /** Concatenate with another sequence (EF-style) */
  concat(other: Queryable<T>): Queryable<T>;
  /** Add a JOIN clause into the model using simple predicate parsing. */
  private addJoin;
  /**
   * Parse a two-parameter predicate into a SQL ON expression.
   * Supports pattern: (a,b) => a.prop === b.prop
   */
  private parseJoinPredicate;
  /** Apply configured global filters to the provided query model. */
  private applyGlobalFiltersToModel;
}
//# sourceMappingURL=Queryable.d.ts.map
