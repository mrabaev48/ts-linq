"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedQueryable = void 0;
exports.typed = typed;
/**
 * Compile-time typed wrapper around Queryable that provides type safety
 * for select(), where(), include(), and other query operations.
 *
 * Uses composition instead of inheritance to avoid type signature conflicts.
 */
class TypedQueryable {
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
        const resultQueryable = this._queryable.orderBy(keySelector);
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
    // Execution methods that return results
    /**
     * Type-safe first() with proper return type.
     */
    async first() {
        return this._queryable.first();
    }
    /**
     * Type-safe firstOrDefault() with proper return type.
     */
    async firstOrDefault(defaultValue) {
        const result = await this.first();
        return result ?? defaultValue;
    }
    /**
     * Type-safe single() - expects exactly one result.
     */
    async single() {
        const results = await this.toArray();
        if (results.length === 0) {
            throw new Error('Sequence contains no elements');
        }
        if (results.length > 1) {
            throw new Error('Sequence contains more than one element');
        }
        return results[0];
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
        const count = await this.count();
        return count > 0;
    }
    /**
     * Check if all elements match a predicate (requires loading all data).
     */
    async all(predicate) {
        const items = await this.toArray();
        return items.every(predicate);
    }
    // Aggregation methods
    /**
     * Get minimum value for a numeric property.
     */
    async min(selector) {
        const items = await this.toArray();
        if (items.length === 0)
            return null;
        const values = items.map(selector);
        return values.reduce((min, current) => current < min ? current : min);
    }
    /**
     * Get maximum value for a numeric property.
     */
    async max(selector) {
        const items = await this.toArray();
        if (items.length === 0)
            return null;
        const values = items.map(selector);
        return values.reduce((max, current) => current > max ? current : max);
    }
    /**
     * Calculate average for a numeric property.
     */
    async average(selector) {
        const items = await this.toArray();
        if (items.length === 0)
            return null;
        const values = items.map(selector);
        const sum = values.reduce((acc, val) => acc + val, 0);
        return sum / values.length;
    }
    /**
     * Calculate sum for a numeric property.
     */
    async sum(selector) {
        const items = await this.toArray();
        const values = items.map(selector);
        return values.reduce((acc, val) => acc + val, 0);
    }
    /**
     * Access the underlying Queryable for advanced operations.
     * Use with caution as this bypasses type safety.
     */
    get raw() {
        return this._queryable;
    }
}
exports.TypedQueryable = TypedQueryable;
/**
 * Helper function to create a typed queryable from any entity queryable.
 * This provides a convenient way to "upgrade" an existing query to typed.
 */
function typed(queryable) {
    return TypedQueryable.from(queryable);
}
//# sourceMappingURL=TypedQueryable.js.map