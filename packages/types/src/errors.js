// Error classes - no external dependencies
export class DatabaseError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'DatabaseError';
    }
}
export class OptimisticConcurrencyError extends DatabaseError {
    constructor(message) {
        super(message);
        this.name = 'OptimisticConcurrencyError';
    }
}
export class UniqueConstraintError extends DatabaseError {
    constructor(message, table, column) {
        super(message);
        this.table = table;
        this.column = column;
        this.name = 'UniqueConstraintError';
    }
}
export class ForeignKeyConstraintError extends DatabaseError {
    constructor(message, table, constraint) {
        super(message);
        this.table = table;
        this.constraint = constraint;
        this.name = 'ForeignKeyConstraintError';
    }
}
//# sourceMappingURL=errors.js.map