export declare class DatabaseError extends Error {
    readonly cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
export declare class OptimisticConcurrencyError extends DatabaseError {
    constructor(message: string);
}
export declare class UniqueConstraintError extends DatabaseError {
    readonly table?: string | undefined;
    readonly column?: string | undefined;
    constructor(message: string, table?: string | undefined, column?: string | undefined);
}
export declare class ForeignKeyConstraintError extends DatabaseError {
    readonly table?: string | undefined;
    readonly constraint?: string | undefined;
    constructor(message: string, table?: string | undefined, constraint?: string | undefined);
}
//# sourceMappingURL=errors.d.ts.map