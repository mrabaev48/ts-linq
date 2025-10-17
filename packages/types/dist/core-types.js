"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitOpenError = exports.OptimisticConcurrencyError = exports.ValidationError = exports.ForeignKeyConstraintError = exports.UniqueConstraintError = exports.DatabaseError = exports.err = exports.ok = exports.JoinType = exports.LoadingStrategy = exports.EntityState = void 0;
exports.unbrandId = unbrandId;
exports.brandId = brandId;
exports.isBrandedId = isBrandedId;
/**
 * Core types and metadata contracts used across the ORM.
 */
var EntityState;
(function (EntityState) {
    EntityState["Unchanged"] = "unchanged";
    EntityState["Added"] = "added";
    EntityState["Modified"] = "modified";
    EntityState["Deleted"] = "deleted";
})(EntityState || (exports.EntityState = EntityState = {}));
/**
 * Strategy for loading related entities.
 * - Lazy: relationships are not auto-loaded
 * - Eager: relationships are loaded immediately
 */
var LoadingStrategy;
(function (LoadingStrategy) {
    LoadingStrategy["Lazy"] = "lazy";
    LoadingStrategy["Eager"] = "eager";
})(LoadingStrategy || (exports.LoadingStrategy = LoadingStrategy = {}));
/**
 * SQL join types supported by the query builder.
 */
var JoinType;
(function (JoinType) {
    JoinType["Inner"] = "INNER";
    JoinType["Left"] = "LEFT";
    JoinType["Right"] = "RIGHT";
    JoinType["Full"] = "FULL";
})(JoinType || (exports.JoinType = JoinType = {}));
/** Create a successful Result. */
const ok = (value) => ({ ok: true, value });
exports.ok = ok;
/** Create a failed Result. */
const err = (error) => ({ ok: false, error });
exports.err = err;
/** Generic database error with optional engine-specific code. */
class DatabaseError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
    }
}
exports.DatabaseError = DatabaseError;
/** Unique constraint violation error. */
class UniqueConstraintError extends DatabaseError {
    constructor(message, code) {
        super(message, code);
        this.name = 'UniqueConstraintError';
    }
}
exports.UniqueConstraintError = UniqueConstraintError;
/** Foreign key constraint violation error. */
class ForeignKeyConstraintError extends DatabaseError {
    constructor(message, code) {
        super(message, code);
        this.name = 'ForeignKeyConstraintError';
    }
}
exports.ForeignKeyConstraintError = ForeignKeyConstraintError;
/** Validation error for model constraints before persistence. */
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
/** Optimistic concurrency violation error. */
class OptimisticConcurrencyError extends DatabaseError {
    constructor(message = 'Optimistic concurrency check failed', code) {
        super(message, code);
        this.name = 'OptimisticConcurrencyError';
    }
}
exports.OptimisticConcurrencyError = OptimisticConcurrencyError;
/** Thrown when a call is short-circuited due to an open circuit. */
class CircuitOpenError extends Error {
    constructor(message = 'Circuit is open; call short-circuited') {
        super(message);
        this.name = 'CircuitOpenError';
    }
}
exports.CircuitOpenError = CircuitOpenError;
/**
 * Extract the underlying value from a branded type.
 * Useful when interfacing with external APIs that don't use branded types.
 */
function unbrandId(id) {
    return id;
}
/**
 * Brand a raw ID value for type safety.
 * Use this when receiving IDs from external sources.
 */
function brandId(id) {
    return id;
}
/**
 * Type predicate to check if a value is a valid branded ID.
 * Primarily for runtime validation and type narrowing.
 */
function isBrandedId(value) {
    return typeof value === 'string' || typeof value === 'number';
}
//# sourceMappingURL=core-types.js.map