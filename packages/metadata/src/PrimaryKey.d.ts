import type { ColumnOptions } from './Column';
export interface PrimaryKeyOptions extends ColumnOptions {
    autoIncrement?: boolean;
    branded?: boolean;
}
/**
 * Legacy property decorator that marks a property as the primary key.
 */
export declare function PrimaryKey(options?: PrimaryKeyOptions): PropertyDecorator;
//# sourceMappingURL=PrimaryKey.d.ts.map