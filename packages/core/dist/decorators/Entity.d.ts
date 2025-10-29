import 'reflect-metadata';
/**
 * Options for configuring an entity/table.
 */
export interface EntityOptions {
    /** Custom table name; defaults to the class name if not provided. */
    name?: string;
    /** Database schema name (for providers that support schemas). */
    schema?: string;
}
/**
 * Legacy decorator that marks a class as a database entity (table).
 * Uses reflect-metadata for metadata storage.
 */
export declare function Entity(options?: EntityOptions): ClassDecorator;
//# sourceMappingURL=Entity.d.ts.map