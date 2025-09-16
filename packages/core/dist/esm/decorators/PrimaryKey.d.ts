import type { ColumnOptions } from './Column';
/**
 * Options for configuring a primary key property.
 * Extends `ColumnOptions` with `autoIncrement` to mark identity columns.
 */
export interface PrimaryKeyOptions extends ColumnOptions {
    autoIncrement?: boolean;
}
/**
 * Property decorator that marks a property as the primary key.
 *
 * This decorator first registers the property as a non-nullable column and optionally
 * marks it as generated (auto-increment), then records the primary key metadata.
 *
 * @param options Primary key configuration options.
 * @returns A property decorator.
 */
export declare function PrimaryKey(options?: PrimaryKeyOptions): PropertyDecorator;
//# sourceMappingURL=PrimaryKey.d.ts.map