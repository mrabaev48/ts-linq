"use strict";
// Error classes - no external dependencies
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ForeignKeyConstraintError = exports.UniqueConstraintError = exports.OptimisticConcurrencyError = exports.DatabaseError = void 0;
class DatabaseError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class OptimisticConcurrencyError extends DatabaseError {
    constructor(message) {
        super(message);
        this.name = 'OptimisticConcurrencyError';
    }
}
exports.OptimisticConcurrencyError = OptimisticConcurrencyError;
class UniqueConstraintError extends DatabaseError {
    constructor(message, table, column) {
        super(message);
        this.table = table;
        this.column = column;
        this.name = 'UniqueConstraintError';
    }
}
exports.UniqueConstraintError = UniqueConstraintError;
class ForeignKeyConstraintError extends DatabaseError {
    constructor(message, table, constraint) {
        super(message);
        this.table = table;
        this.constraint = constraint;
        this.name = 'ForeignKeyConstraintError';
    }
}
exports.ForeignKeyConstraintError = ForeignKeyConstraintError;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=errors.js.map