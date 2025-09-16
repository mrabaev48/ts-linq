import 'reflect-metadata';
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
//# sourceMappingURL=index.js.map