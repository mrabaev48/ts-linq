import type { ColumnType } from '@ts-linq/types';
/**
 * Options for configuring a column mapping on an entity property.
 */
export interface ColumnOptions {
    name?: string;
    type?: ColumnType | string;
    nullable?: boolean;
    defaultValue?: unknown;
    length?: number;
    precision?: number;
    scale?: number;
    generated?: boolean;
    /** Marks this column as an optimistic concurrency token (version). */
    version?: boolean;
}
/**
 * Stage-3 property decorator that registers column metadata.
 * @param options.type - Column type (required for non-TEXT columns). Defaults to TEXT if omitted.
 */
export declare function Column(options?: ColumnOptions): PropertyDecorator;
//# sourceMappingURL=Column.d.ts.map