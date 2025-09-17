import type { ColumnOptions } from './Column';
/**
 * Options for configuring a primary key property.
 * Extends `ColumnOptions` with `autoIncrement` to mark identity columns
 * and `branded` for compile-time type safety.
 */
export interface PrimaryKeyOptions extends ColumnOptions {
    autoIncrement?: boolean;
    /**
     * Enable branded ID type for this primary key.
     * When true, the property type should be EntityId<T, EntityName>.
     * Provides compile-time safety to prevent mixing IDs of different entities.
     * @default false
     */
    branded?: boolean;
}
/**
 * Property decorator that marks a property as the primary key.
 *
 * Supports both legacy (experimentalDecorators) and TS5 Stage-3 field decorators.
 */
export declare function PrimaryKey(options?: PrimaryKeyOptions): PropertyDecorator;
//# sourceMappingURL=PrimaryKey.d.ts.map