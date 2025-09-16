/**
 * Compile-time typed wrapper around Queryable that provides type safety
 * for select(), where(), include(), and other query operations.
 *
 * Uses composition instead of inheritance to avoid type signature conflicts.
 */
export class TypedQueryable {
    constructor(queryable) {
        this._queryable = queryable;
    }
    /**
     * Create a typed queryable from a regular queryable.
     */
    static from(queryable) {
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
    select(selector) {
        // For now, delegate to the underlying queryable with the selector function
        // In a full implementation, we would parse the selector to extract field names
        const resultQueryable = this._queryable.select(selector);
        return new TypedQueryable(resultQueryable);
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
    where(predicate) {
        const resultQueryable = this._queryable.where(predicate);
        return new TypedQueryable(resultQueryable);
    }
    /**
     * Type-safe ORDER BY with property validation.
     *
     * @example
     * ```typescript
     * users.orderBy(u => u.createdAt, 'DESC')
     * users.orderBy(u => u.name) // defaults to ASC
     * ```
     */
    orderBy(keySelector, direction = 'ASC') {
        // Delegate to correct underlying method based on direction
        const resultQueryable = direction === 'DESC'
            ? this._queryable.orderByDescending(keySelector)
            : this._queryable.orderBy(keySelector);
        return new TypedQueryable(resultQueryable);
    }
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
    include(navigationSelector) {
        const resultQueryable = this._queryable.include(navigationSelector);
        return new TypedQueryable(resultQueryable);
    }
    /**
     * Type-safe limit with number validation.
     */
    take(count) {
        const resultQueryable = this._queryable.take(count);
        return new TypedQueryable(resultQueryable);
    }
    /**
     * Type-safe skip/offset.
     */
    skip(count) {
        const resultQueryable = this._queryable.skip(count);
        return new TypedQueryable(resultQueryable);
    }
    /**
     * Type-safe distinct operation.
     */
    distinct() {
        const resultQueryable = this._queryable.distinct();
        return new TypedQueryable(resultQueryable);
    }
    /**
     * Type-safe secondary ordering in ascending order.
     * Must be used after orderBy() or orderByDescending().
     */
    thenBy(keySelector) {
        const resultQueryable = this._queryable.thenBy(keySelector);
        return new TypedQueryable(resultQueryable);
    }
    /**
     * Type-safe secondary ordering in descending order.
     * Must be used after orderBy() or orderByDescending().
     */
    thenByDescending(keySelector) {
        const resultQueryable = this._queryable.thenByDescending(keySelector);
        return new TypedQueryable(resultQueryable);
    }
    // Execution methods that return results
    /**
     * Type-safe first() with proper return type.
     * Throws if no elements found, consistent with underlying Queryable.
     */
    async first() {
        return this._queryable.first();
    }
    /**
     * Type-safe firstOrDefault() with proper return type.
     */
    async firstOrDefault() {
        return this._queryable.firstOrDefault();
    }
    /**
     * Type-safe single() - expects exactly one result.
     */
    async single() {
        return this._queryable.single();
    }
    /**
     * Type-safe toArray() with proper return type.
     */
    async toArray() {
        return this._queryable.toArray();
    }
    /**
     * Type-safe count() operation.
     */
    async count() {
        return this._queryable.count();
    }
    /**
     * Type-safe any() - check if any elements exist matching the query.
     */
    async any() {
        return this._queryable.any();
    }
    /**
     * Check if all elements match a predicate (requires loading all data).
     * WARNING: This loads all data into memory. Use with caution on large datasets.
     */
    async all(predicate) {
        const items = await this.toArray();
        return items.every(predicate);
    }
    // Entity Framework-style aggregation methods (restored for EF compatibility)
    /**
     * Calculate average of a numeric property (EF-style with type safety)
     */
    async average(selector) {
        return await this._queryable.average(selector);
    }
    /**
     * Calculate sum of a numeric property (EF-style with type safety)
     */
    async sum(selector) {
        return await this._queryable.sum(selector);
    }
    /**
     * Find minimum value of a property (EF-style with type safety)
     */
    async min(selector) {
        return await this._queryable.min(selector);
    }
    /**
     * Find maximum value of a property (EF-style with type safety)
     */
    async max(selector) {
        return await this._queryable.max(selector);
    }
    /**
     * Check if the sequence contains a specific element (EF-style)
     */
    async contains(item) {
        return await this._queryable.contains(item);
    }
    /**
     * Get elements that are in this sequence but not in the other (EF-style)
     */
    except(other) {
        const resultQueryable = this._queryable.except(other._queryable);
        return TypedQueryable.from(resultQueryable);
    }
    /**
     * Get elements that are in both sequences (EF-style)
     */
    intersect(other) {
        const resultQueryable = this._queryable.intersect(other._queryable);
        return TypedQueryable.from(resultQueryable);
    }
    /**
     * Concatenate with another sequence (EF-style)
     */
    concat(other) {
        const resultQueryable = this._queryable.concat(other._queryable);
        return TypedQueryable.from(resultQueryable);
    }
    /**
     * Access the underlying Queryable for advanced operations.
     * Use with caution as this bypasses type safety.
     */
    get raw() {
        return this._queryable;
    }
}
/**
 * Helper function to create a typed queryable from any entity queryable.
 * This provides a convenient way to "upgrade" an existing query to typed.
 */
export function typed(queryable) {
    return TypedQueryable.from(queryable);
}
//# sourceMappingURL=TypedQueryable.js.map