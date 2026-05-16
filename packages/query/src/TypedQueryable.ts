import type { ExpressionNode } from '@ts-linq/ast';
import type { SqlParameter } from '@ts-linq/types';

import type { Queryable } from './Queryable';

/**
 * Type-safe selector function that only allows selecting valid entity properties.
 */
type TypedSelector<TEntity, TResult> = (entity: TEntity) => TResult;

/**
 * Type-safe predicate function for WHERE clauses.
 */
type TypedPredicate<TEntity> = (entity: TEntity) => boolean;

/**
 * Extract only relationship properties from an entity.
 * Relationship properties are arrays or objects (not primitives).
 */
type RelationshipProperties<T> = {
  [K in keyof T]: T[K] extends Array<unknown>
    ? K
    : T[K] extends object
      ? T[K] extends Date
        ? never
        : T[K] extends Function
          ? never
          : K
      : never;
}[keyof T];

/**
 * Compile-time typed wrapper around Queryable that provides type safety
 * for select(), where(), include(), and other query operations.
 *
 * Uses composition instead of inheritance to avoid type signature conflicts.
 */
export class TypedQueryable<TEntity> {
  /** Used by the compile-time transformer to identify TypedQueryable instances. Do not use at runtime. */
  declare readonly __tsLinqWhereTransformerBrand: true;

  private readonly _queryable: Queryable<TEntity>;

  constructor(queryable: Queryable<TEntity>) {
    this._queryable = queryable;
  }

  /**
   * Create a typed queryable from a regular queryable.
   */
  static from<T>(queryable: Queryable<T>): TypedQueryable<T> {
    return new TypedQueryable(queryable);
  }

  /**
   * Type-safe SELECT with compile-time validation of selected properties.
   * Only allows selecting properties that actually exist on the entity.
   *
   * @example
   * ```typescript
   * // ✅ Valid - selecting existing properties
   * users.select(u => ({ id: u.id, name: u.name }))
   *
   * // ❌ Compile error - nonExistent property doesn't exist
   * users.select(u => ({ invalid: u.nonExistent }))
   * ```
   */
  select<TResult>(selector: TypedSelector<TEntity, TResult>): TypedQueryable<TResult> {
    const resultQueryable = this._queryable.select(selector);
    return new TypedQueryable(resultQueryable as unknown as Queryable<TResult>);
  }

  /**
   * Type-safe WHERE clause with compile-time property validation.
   * The predicate function receives a typed entity parameter.
   *
   * @example
   * ```typescript
   * // ✅ Valid - using existing properties
   * users.where(u => u.age > 18)
   * users.where(u => u.name === 'John')
   *
   * // ❌ Compile error - invalid property
   * users.where(u => u.nonExistent === 'value')
   * ```
   */
  where(predicate: TypedPredicate<TEntity>): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.where(predicate);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Adds a filter predicate that has been compiled to a query AST at build time.
   *
   * This method is intended to be called only by the compile-time transformer.
   */
  whereCompiled(input: {
    readonly ast: ExpressionNode;
    readonly parameters: readonly unknown[];
  }): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.whereCompiled(input);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe ORDER BY with property key validation.
   *
   * @example
   * ```typescript
   * users.orderBy('createdAt', 'DESC')
   * users.orderBy('name') // defaults to ASC
   * ```
   */
  orderBy<K extends keyof TEntity>(key: K, direction: 'ASC' | 'DESC' = 'ASC'): TypedQueryable<TEntity> {
    const resultQueryable =
      direction === 'DESC'
        ? this._queryable.orderByDescending(key)
        : this._queryable.orderBy(key);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe INCLUDE for relationships with compile-time validation.
   * Only allows including properties that are actual relationships (arrays or nested objects).
   *
   * @example
   * ```typescript
   * // ✅ Valid - including existing relationship
   * users.include('orders')
   *
   * // ❌ Compile error - not a relationship property
   * users.include('name')
   * ```
   */
  include<K extends RelationshipProperties<TEntity> & string>(key: K): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.include(key as keyof TEntity & string);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe limit with number validation.
   */
  take(count: number): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.take(count);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe skip/offset.
   */
  skip(count: number): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.skip(count);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe distinct operation.
   */
  distinct(): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.distinct();
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe secondary ordering in ascending order.
   * Must be used after orderBy() or orderByDescending().
   */
  thenBy<K extends keyof TEntity>(key: K): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.thenBy(key);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Type-safe secondary ordering in descending order.
   * Must be used after orderBy() or orderByDescending().
   */
  thenByDescending<K extends keyof TEntity>(key: K): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.thenByDescending(key);
    return new TypedQueryable(resultQueryable);
  }

  /**
   * Paginate by page number and size (typed proxy).
   */
  async paginate(
    page: number,
    size: number
  ): Promise<{ items: TEntity[]; total: number; page: number; size: number }> {
    return await (
      this._queryable as unknown as {
        paginate: (
          page: number,
          size: number
        ) => Promise<{ items: TEntity[]; total: number; page: number; size: number }>;
      }
    ).paginate(page, size);
  }

  /**
   * Keyset pagination helper (typed proxy).
   */
  async keysetPaginate<TKey extends keyof TEntity>(
    key: TKey,
    after: TEntity[TKey] | null,
    size: number
  ): Promise<{ items: TEntity[]; pageSize: number; nextAfter: TEntity[TKey] | null }> {
    return await (
      this._queryable as unknown as {
        keysetPaginate: (
          key: TKey,
          after: TEntity[TKey] | null,
          size: number
        ) => Promise<{ items: TEntity[]; pageSize: number; nextAfter: TEntity[TKey] | null }>;
      }
    ).keysetPaginate(key, after, size);
  }

  /** Attach AbortSignal (typed proxy) */
  withAbort(signal: AbortSignal): TypedQueryable<TEntity> {
    const q = (
      this._queryable as unknown as { withAbort: (s: AbortSignal) => Queryable<TEntity> }
    ).withAbort(signal);
    return new TypedQueryable(q);
  }

  // Execution methods that return results

  /**
   * Type-safe first() with proper return type.
   * Throws if no elements found, consistent with underlying Queryable.
   */
  async first(): Promise<TEntity> {
    return this._queryable.first();
  }

  /**
   * Type-safe firstOrDefault() with proper return type.
   */
  async firstOrDefault(): Promise<TEntity | null> {
    return this._queryable.firstOrDefault();
  }

  /**
   * Type-safe single() - expects exactly one result.
   */
  async single(): Promise<TEntity> {
    return this._queryable.single();
  }

  /**
   * Type-safe toArray() with proper return type.
   */
  async toArray(): Promise<TEntity[]> {
    return this._queryable.toArray();
  }

  /**
   * Type-safe count() operation.
   */
  async count(): Promise<number> {
    return this._queryable.count();
  }

  /**
   * Type-safe any() - check if any elements exist matching the query.
   */
  async any(): Promise<boolean> {
    return this._queryable.any();
  }

  /**
   * Check if all elements match a predicate (requires loading all data).
   * WARNING: This loads all data into memory. Use with caution on large datasets.
   */
  async all(predicate: TypedPredicate<TEntity>): Promise<boolean> {
    const items = await this.toArray();
    return items.every((e) => predicate(e));
  }

  // Entity Framework-style aggregation methods (restored for EF compatibility)

  /**
   * Calculate average of a numeric property (EF-style with type safety)
   */
  async average<K extends keyof TEntity>(key: K): Promise<number> {
    return await this._queryable.average(key);
  }

  /**
   * Calculate sum of a numeric property (EF-style with type safety)
   */
  async sum<K extends keyof TEntity>(key: K): Promise<number> {
    return await this._queryable.sum(key);
  }

  /**
   * Find minimum value of a property (EF-style with type safety)
   */
  async min<K extends keyof TEntity>(key: K): Promise<TEntity[K]> {
    return await this._queryable.min(key);
  }

  /**
   * Find maximum value of a property (EF-style with type safety)
   */
  async max<K extends keyof TEntity>(key: K): Promise<TEntity[K]> {
    return await this._queryable.max(key);
  }

  /**
   * Check if the sequence contains a specific element (EF-style)
   */
  async contains(item: TEntity): Promise<boolean> {
    return await this._queryable.contains(item);
  }

  /**
   * Get elements that are in this sequence but not in the other (EF-style)
   */
  except(other: TypedQueryable<TEntity>): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.except(other._queryable);
    return TypedQueryable.from(resultQueryable);
  }

  /**
   * Get elements that are in both sequences (EF-style)
   */
  intersect(other: TypedQueryable<TEntity>): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.intersect(other._queryable);
    return TypedQueryable.from(resultQueryable);
  }

  /**
   * Concatenate with another sequence (EF-style)
   */
  concat(other: TypedQueryable<TEntity>): TypedQueryable<TEntity> {
    const resultQueryable = this._queryable.concat(other._queryable);
    return TypedQueryable.from(resultQueryable);
  }

  /**
   * Type-safe INNER JOIN on a single equality key pair.
   *
   * @example
   * context.books.innerJoinOn(Author, 'authorId', 'id')
   */
  innerJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: keyof TEntity & string,
    rightKey: keyof TOther & string,
    alias?: string
  ): TypedQueryable<TEntity> {
    return new TypedQueryable(this._queryable.innerJoinOn(otherCtor, leftKey, rightKey, alias));
  }

  /**
   * Type-safe LEFT JOIN on a single equality key pair.
   *
   * @example
   * context.books.leftJoinOn(Author, 'authorId', 'id')
   */
  leftJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: keyof TEntity & string,
    rightKey: keyof TOther & string,
    alias?: string
  ): TypedQueryable<TEntity> {
    return new TypedQueryable(this._queryable.leftJoinOn(otherCtor, leftKey, rightKey, alias));
  }

  /**
   * Result-returning variant of first(). Returns ok(T) or err(Error).
   */
  async tryFirst(): Promise<import('@ts-linq/types').Result<TEntity, Error>> {
    const { tryFirst: fn } = await import('./queryUtils');
    return fn(this._queryable);
  }

  /**
   * Result-returning variant of single(). Returns ok(T) or err(Error).
   */
  async trySingle(): Promise<import('@ts-linq/types').Result<TEntity, Error>> {
    const { trySingle: fn } = await import('./queryUtils');
    return fn(this._queryable);
  }

  /**
   * Access the underlying Queryable for advanced operations.
   * Use with caution as this bypasses type safety.
   */
  get raw(): Queryable<TEntity> {
    return this._queryable;
  }
}

/**
 * Helper function to create a typed queryable from any entity queryable.
 * This provides a convenient way to "upgrade" an existing query to typed.
 */
export function typed<T>(queryable: Queryable<T>): TypedQueryable<T> {
  return TypedQueryable.from(queryable);
}
