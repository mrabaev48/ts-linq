import { Queryable } from './Queryable';
/**
 * Type-safe selector function that only allows selecting valid entity properties.
 */
type TypedSelector<TEntity, TResult> = (entity: TEntity) => TResult;
/**
 * Type-safe predicate function for WHERE clauses.
 */
type TypedPredicate<TEntity> = (entity: TEntity) => boolean;
/**
 * Type-safe ordering selector function.
 */
type TypedOrderSelector<TEntity> = (entity: TEntity) => any;
/**
 * Compile-time typed wrapper around Queryable that provides type safety
 * for select(), where(), include(), and other query operations.
 *
 * Uses composition instead of inheritance to avoid type signature conflicts.
 */
export declare class TypedQueryable<TEntity> {
    private readonly _queryable;
    constructor(queryable: Queryable<TEntity>);
    /**
     * Create a typed queryable from a regular queryable.
     */
    static from<T>(queryable: Queryable<T>): TypedQueryable<T>;
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
    select<TResult>(selector: TypedSelector<TEntity, TResult>): TypedQueryable<TResult>;
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
    where(predicate: TypedPredicate<TEntity>): TypedQueryable<TEntity>;
    /**
     * Type-safe ORDER BY with property validation.
     *
     * @example
     * ```typescript
     * users.orderBy(u => u.createdAt, 'DESC')
     * users.orderBy(u => u.name) // defaults to ASC
     * ```
     */
    orderBy<TKey>(keySelector: TypedOrderSelector<TEntity>, direction?: 'ASC' | 'DESC'): TypedQueryable<TEntity>;
    /**
     * Type-safe INCLUDE for relationships with compile-time validation.
     * Only allows including properties that are actual relationships.
     *
     * @example
     * ```typescript
     * // ✅ Valid - including existing relationship
     * users.include(u => u.orders)
     *
     * // ❌ Compile error - not a relationship property
     * users.include(u => u.name)
     * ```
     */
    include<TProperty>(navigationSelector: (entity: TEntity) => TProperty): TypedQueryable<TEntity>;
    /**
     * Type-safe limit with number validation.
     */
    take(count: number): TypedQueryable<TEntity>;
    /**
     * Type-safe skip/offset.
     */
    skip(count: number): TypedQueryable<TEntity>;
    /**
     * Type-safe distinct operation.
     */
    distinct(): TypedQueryable<TEntity>;
    /**
     * Type-safe first() with proper return type.
     */
    first(): Promise<TEntity | null>;
    /**
     * Type-safe firstOrDefault() with proper return type.
     */
    firstOrDefault(defaultValue: TEntity): Promise<TEntity>;
    /**
     * Type-safe single() - expects exactly one result.
     */
    single(): Promise<TEntity>;
    /**
     * Type-safe toArray() with proper return type.
     */
    toArray(): Promise<TEntity[]>;
    /**
     * Type-safe count() operation.
     */
    count(): Promise<number>;
    /**
     * Type-safe any() - check if any elements exist matching the query.
     */
    any(): Promise<boolean>;
    /**
     * Check if all elements match a predicate (requires loading all data).
     */
    all(predicate: TypedPredicate<TEntity>): Promise<boolean>;
    /**
     * Get minimum value for a numeric property.
     */
    min<TResult>(selector: (entity: TEntity) => TResult): Promise<TResult | null>;
    /**
     * Get maximum value for a numeric property.
     */
    max<TResult>(selector: (entity: TEntity) => TResult): Promise<TResult | null>;
    /**
     * Calculate average for a numeric property.
     */
    average(selector: (entity: TEntity) => number): Promise<number | null>;
    /**
     * Calculate sum for a numeric property.
     */
    sum(selector: (entity: TEntity) => number): Promise<number>;
    /**
     * Access the underlying Queryable for advanced operations.
     * Use with caution as this bypasses type safety.
     */
    get raw(): Queryable<TEntity>;
}
/**
 * Helper function to create a typed queryable from any entity queryable.
 * This provides a convenient way to "upgrade" an existing query to typed.
 */
export declare function typed<T>(queryable: Queryable<T>): TypedQueryable<T>;
export {};
//# sourceMappingURL=TypedQueryable.d.ts.map