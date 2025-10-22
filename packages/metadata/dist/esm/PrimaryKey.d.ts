import type { ColumnOptions } from './Column';
export interface PrimaryKeyOptions extends ColumnOptions {
    autoIncrement?: boolean;
    branded?: boolean;
}
export declare function PrimaryKey(options?: PrimaryKeyOptions): PropertyDecorator;
//# sourceMappingURL=PrimaryKey.d.ts.map