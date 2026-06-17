import type { ExpressionNode } from '@ts-linq/ast';
import type { FallbackPolicy, QueryFallback } from '@ts-linq/types';

import type { QueryTagList } from './ast/query-tags';
import type { KeySelector } from './extractKey';
import type { IncludeSubquery, NavigationProxy } from './include/IncludeSubquery';
import type { IncludableQueryable, NavElement, OrderedQueryable, Queryable } from './Queryable';
import type { ISetPropertyCalls } from './SetPropertyCalls';

/**
 * The full chain-starting query operator surface of {@link Queryable}.
 *
 * This is the single source of truth that keeps `DbSet<T>` and `Queryable<T>` in parity:
 * `Queryable<T>` *implements* this contract, and `DbSet<T>` *declaration-merges* it so every
 * operator is reachable directly from a set (`ctx.users.where(...).toArray()`), with the actual
 * runtime forwarding installed once against a cached seed `Queryable`.
 *
 * Mid-chain-only operators that require prior chain state (`thenInclude`, which needs a preceding
 * `include`) are intentionally **not** part of this surface — they only exist on `Queryable`.
 *
 * The branded `*Compiled` members are emitted by the compile-time transformer
 * (`@ts-linq/transformer`); they must remain on every type the transformer rewrites against.
 *
 * @typeParam T - The entity element type.
 */
export interface IQueryableSurface<T> {
  // ─── Filter ────────────────────────────────────────────────────────────────
  /** Adds a WHERE predicate. Requires the compile-time transformer (@ts-linq/transformer). */
  where(predicate: (entity: T) => boolean): Queryable<T>;
  /** Called by the compile-time transformer — do not call directly. */
  whereCompiled(input: {
    readonly ast: ExpressionNode;
    readonly parameters: readonly unknown[];
  }): Queryable<T>;
  /** Adds a WHERE IN clause for a specific column. */
  whereIn<K extends keyof T & string>(column: K, values: ReadonlyArray<T[K]>): Queryable<T>;
  /** Adds a WHERE EXISTS (subquery) predicate. */
  whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T>;
  /** Adds a WHERE col IN (subquery) predicate. */
  whereInSubquery<TOther>(column: keyof T & string, subquery: Queryable<TOther>): Queryable<T>;

  // ─── Projection ──────────────────────────────────────────────────────────────
  /** Projects entities. Requires the compile-time transformer. */
  select<TResult>(selector: (entity: T) => TResult): Queryable<TResult>;
  /** Called by the compile-time transformer — do not call directly. */
  selectCompiled<TResult>(input: { readonly fields: readonly string[] }): Queryable<TResult>;

  // ─── Ordering ────────────────────────────────────────────────────────────────
  /** Sorts ascending by property key or lambda selector. */
  orderBy<K extends keyof T>(keyOrSelector: K | KeySelector<T, K>): OrderedQueryable<T>;
  /** Sorts descending by property key or lambda selector. */
  orderByDescending<K extends keyof T>(keyOrSelector: K | KeySelector<T, K>): OrderedQueryable<T>;

  // ─── Pagination (mid-chain) ───────────────────────────────────────────────────
  /** Limits the number of returned rows (SQL LIMIT). */
  take(count: number): Queryable<T>;
  /** Skips the given number of rows (SQL OFFSET). */
  skip(count: number): Queryable<T>;

  // ─── Grouping ────────────────────────────────────────────────────────────────
  /** Groups results by a property key (SQL GROUP BY). */
  groupBy<K extends keyof T>(key: K): Queryable<T>;
  /** Applies a HAVING predicate. Requires the compile-time transformer. */
  having(predicate: (entity: T) => boolean): Queryable<T>;
  /** Called by the compile-time transformer — do not call directly. */
  havingCompiled(input: {
    readonly ast: ExpressionNode;
    readonly parameters: readonly unknown[];
  }): Queryable<T>;

  // ─── Distinct ────────────────────────────────────────────────────────────────
  /** Ensures distinct rows (SQL DISTINCT). */
  distinct(): Queryable<T>;

  // ─── Eager loading ─────────────────────────────────────────────────────────────
  /** Eager-loads a related entity by navigation property name. */
  include<K extends keyof T & string>(key: K): IncludableQueryable<T, NavElement<T[K]>>;
  /** Eager-loads a related entity by lambda selector. */
  include<TProp>(selector: (entity: T) => TProp): IncludableQueryable<T, NavElement<TProp>>;
  /** Eager-loads a related entity by filtered lambda (where/orderBy/take inside include). */
  include<U>(
    selector: (entity: NavigationProxy<T>) => IncludeSubquery<U>
  ): IncludableQueryable<T, U>;

  // ─── Set operations ─────────────────────────────────────────────────────────────
  /** SQL UNION (distinct). */
  union(other: Queryable<T>): Queryable<T>;
  /** SQL UNION ALL. */
  unionAll(other: Queryable<T>): Queryable<T>;
  /** Concatenates sequences preserving duplicates (SQL UNION ALL). */
  concat(other: Queryable<T>): Queryable<T>;
  /** SQL INTERSECT. */
  intersect(other: Queryable<T>): Queryable<T>;
  /** SQL EXCEPT. */
  except(other: Queryable<T>): Queryable<T>;

  // ─── Joins ──────────────────────────────────────────────────────────────────────
  // NOTE: the key parameters are intentionally widened to the full key union here. The precise
  // per-key generics (`KL`/`KR`) live on `Queryable.innerJoinOn`/`leftJoinOn` and on the explicit
  // `DbSet` forwarders — generic methods with type-parameter defaults referencing `T` cannot be
  // related across an `implements` boundary (TS2416), so the contract surface uses the widest
  // assignable shape while concrete classes keep the inference-friendly signature.
  /** Adds a type-safe INNER JOIN on an equality key pair. */
  innerJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: (keyof T & string) | KeySelector<T, keyof T>,
    rightKey: (keyof TOther & string) | KeySelector<TOther, keyof TOther>,
    alias?: string
  ): Queryable<T>;
  /** Adds a type-safe LEFT JOIN on an equality key pair. */
  leftJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: (keyof T & string) | KeySelector<T, keyof T>,
    rightKey: (keyof TOther & string) | KeySelector<TOther, keyof TOther>,
    alias?: string
  ): Queryable<T>;

  // ─── CTE / resilience / cancellation ────────────────────────────────────────────
  /** Defines a named CTE (WITH ...) subquery. */
  withCte(name: string, subquery: Queryable<unknown>): Queryable<T>;
  /** Registers a graceful-degradation fallback source. */
  fallbackTo(source: QueryFallback<T>): Queryable<T>;
  /** Overrides per-query fallback policy. */
  withFallbackPolicy(policy: Partial<FallbackPolicy>): Queryable<T>;
  /** Attaches an AbortSignal to cancel the query before it hits the provider. */
  withAbort(signal: AbortSignal): Queryable<T>;

  // ─── Tracking ────────────────────────────────────────────────────────────────────
  /** Return a Queryable with change-tracker attachment disabled. */
  asNoTracking(): Queryable<T>;
  /** Return a Queryable with change-tracker attachment enabled (the default). */
  asTracking(): Queryable<T>;
  /** Return a Queryable that deduplicates by PK without attaching to the change tracker. */
  asNoTrackingWithIdentityResolution(): Queryable<T>;

  // ─── Query splitting ───────────────────────────────────────────────────────────────
  /** Override the query-splitting strategy for this chain to `SplitQuery`. */
  asSplitQuery(): Queryable<T>;
  /** Override the query-splitting strategy for this chain to `SingleQuery`. */
  asSingleQuery(): Queryable<T>;

  // ─── Inheritance ───────────────────────────────────────────────────────────────────
  /** Filters the query to return only instances of the given subtype (EF Core `OfType<TSub>()`). */
  ofType<TSub extends T>(ctor: new () => TSub): Queryable<TSub>;

  // ─── Global filters ─────────────────────────────────────────────────────────────────
  /** Disables all model-level global query filters for this query (EF9 parity). */
  ignoreQueryFilters(): Queryable<T>;
  /** Disables only the specified named global query filters for this query. */
  ignoreQueryFilters(...names: string[]): Queryable<T>;

  // ─── Query tagging ──────────────────────────────────────────────────────────────────
  /** Attach a diagnostic comment to the emitted SQL statement (EF Core `TagWith`). */
  tagWith(tag: string): Queryable<T>;
  /** Attach the caller's source file and line number as a diagnostic tag. */
  tagWithCallSite(): Queryable<T>;
  /** Return the ordered list of tags attached to the underlying queryable. */
  getTags(): QueryTagList;

  // ─── Temporal (SQL Server system-versioned tables) ─────────────────────────────────────
  /** Query the entity state at a specific point in time. */
  temporalAsOf(pointInTime: Date): Queryable<T>;
  /** Query all historical and current rows. */
  temporalAll(): Queryable<T>;
  /** Query rows active at any point within the half-open interval [from, to). */
  temporalBetween(from: Date, to: Date): Queryable<T>;
  /** Query rows active at any point within the open interval (from, to). */
  temporalFromTo(from: Date, to: Date): Queryable<T>;
  /** Query rows whose entire active period falls within [from, to]. */
  temporalContainedIn(from: Date, to: Date): Queryable<T>;

  // ─── Bulk DML ───────────────────────────────────────────────────────────────────────
  /** Executes a bulk UPDATE in a single SQL statement without loading entities. */
  executeUpdate(setters: (s: ISetPropertyCalls<T>) => ISetPropertyCalls<T>): Promise<number>;
  /** Executes a bulk DELETE in a single SQL statement without loading entities. */
  executeDelete(): Promise<number>;

  // ─── Terminal — element retrieval ──────────────────────────────────────────────────────
  /** Executes the query and returns all matching entities. */
  toArray(): Promise<T[]>;
  /** Alias for `toArray()` — matches EF Core's `ToListAsync()` naming. */
  toListAsync(): Promise<T[]>;
  /** Streams entities using chunked pagination (memory-bounded). */
  asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T>;
  /** Executes an async action for each entity, streaming without buffering all results. */
  forEachAsync(action: (entity: T) => void | Promise<void>, signal?: AbortSignal): Promise<void>;
  /** Materializes the query into a Map keyed by keySelector. Throws on duplicate keys. */
  toDictionaryAsync<K>(keySelector: (entity: T) => K, signal?: AbortSignal): Promise<Map<K, T>>;
  toDictionaryAsync<K, V>(
    keySelector: (entity: T) => K,
    elementSelector: (entity: T) => V,
    signal?: AbortSignal
  ): Promise<Map<K, V>>;

  /** Returns the first entity, throws if none. */
  first(): Promise<T>;
  /** Returns the first entity or null. */
  firstOrDefault(): Promise<T | null>;
  /** Returns exactly one entity; throws if 0 or more than 1. */
  single(): Promise<T>;
  /** Returns one entity or null; throws if more than 1. */
  singleOrDefault(): Promise<T | null>;

  // ─── Terminal — aggregates ──────────────────────────────────────────────────────────────
  /** Returns the number of matching rows. */
  count(): Promise<number>;
  /** Returns true if at least one row matches. */
  any(): Promise<boolean>;
  /** Returns true if the sequence contains the given item. */
  contains(item: T): Promise<boolean>;
  /** Returns the sum of a numeric property. */
  sum<K extends keyof T>(key: K): Promise<number>;
  /** Returns the average of a numeric property. */
  average<K extends keyof T>(key: K): Promise<number>;
  /** Returns the minimum value of a property. */
  min<K extends keyof T>(key: K): Promise<T[K]>;
  /** Returns the maximum value of a property. */
  max<K extends keyof T>(key: K): Promise<T[K]>;

  // ─── Terminal — pagination ──────────────────────────────────────────────────────────────
  /** Offset-based pagination. */
  paginate(
    page: number,
    size: number
  ): Promise<{ items: T[]; total: number; page: number; size: number }>;
  /** Keyset (cursor-based) pagination. */
  keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }>;
}
