import 'reflect-metadata';
/**
 * Options for configuring an entity/table.
 *
 * - name: Explicit table name. Defaults to the class name if omitted.
 */
export interface EntityOptions {
    name?: string;
}
/**
 * Class decorator that registers a class as a database entity (table).
 * Supports TS5 Stage-3 decorators and legacy decorators.
 */
export declare function Entity(options?: EntityOptions): ClassDecorator;
//# sourceMappingURL=Entity.d.ts.map