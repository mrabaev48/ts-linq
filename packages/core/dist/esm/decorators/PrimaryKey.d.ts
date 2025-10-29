import 'reflect-metadata';
export interface PrimaryKeyOptions {
    name?: string;
    type?: string;
    autoIncrement?: boolean;
    version?: boolean;
    branded?: boolean;
}
/**
 * Legacy property decorator that marks a column as a primary key.
 * Uses reflect-metadata for metadata storage.
 */
export declare function PrimaryKey(options?: PrimaryKeyOptions): PropertyDecorator;
//# sourceMappingURL=PrimaryKey.d.ts.map