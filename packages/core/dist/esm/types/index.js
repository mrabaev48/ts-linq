/**
 * Core types and metadata contracts used across the ORM.
 */
export var EntityState;
(function (EntityState) {
    EntityState["Unchanged"] = "unchanged";
    EntityState["Added"] = "added";
    EntityState["Modified"] = "modified";
    EntityState["Deleted"] = "deleted";
})(EntityState || (EntityState = {}));
/**
 * Strategy for loading related entities.
 * - Lazy: relationships are not auto-loaded
 * - Eager: relationships are loaded immediately
 */
export var LoadingStrategy;
(function (LoadingStrategy) {
    LoadingStrategy["Lazy"] = "lazy";
    LoadingStrategy["Eager"] = "eager";
})(LoadingStrategy || (LoadingStrategy = {}));
/**
 * SQL join types supported by the query builder.
 */
export var JoinType;
(function (JoinType) {
    JoinType["Inner"] = "INNER";
    JoinType["Left"] = "LEFT";
    JoinType["Right"] = "RIGHT";
    JoinType["Full"] = "FULL";
})(JoinType || (JoinType = {}));
/** Create a successful Result. */
export const ok = (value) => ({ ok: true, value });
/** Create a failed Result. */
export const err = (error) => ({ ok: false, error });
/** Generic database error with optional engine-specific code. */
export class DatabaseError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
    }
}
/** Unique constraint violation error. */
export class UniqueConstraintError extends DatabaseError {
    constructor(message, code) {
        super(message, code);
        this.name = 'UniqueConstraintError';
    }
}
/** Foreign key constraint violation error. */
export class ForeignKeyConstraintError extends DatabaseError {
    constructor(message, code) {
        super(message, code);
        this.name = 'ForeignKeyConstraintError';
    }
}
/** Validation error for model constraints before persistence. */
export class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}
/** Optimistic concurrency violation error. */
export class OptimisticConcurrencyError extends DatabaseError {
    constructor(message = 'Optimistic concurrency check failed', code) {
        super(message, code);
        this.name = 'OptimisticConcurrencyError';
    }
}
/** Thrown when a call is short-circuited due to an open circuit. */
export class CircuitOpenError extends Error {
    constructor(message = 'Circuit is open; call short-circuited') {
        super(message);
        this.name = 'CircuitOpenError';
    }
}
/**
 * Extract the underlying value from a branded type.
 * Useful when interfacing with external APIs that don't use branded types.
 */
export function unbrandId(id) {
    return id;
}
/**
 * Brand a raw ID value for type safety.
 * Use this when receiving IDs from external sources.
 */
export function brandId(id) {
    return id;
}
/**
 * Type predicate to check if a value is a valid branded ID.
 * Primarily for runtime validation and type narrowing.
 */
export function isBrandedId(value) {
    return typeof value === 'string' || typeof value === 'number';
}
//# sourceMappingURL=index.js.map