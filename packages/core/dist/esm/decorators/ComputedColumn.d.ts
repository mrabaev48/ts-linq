export interface ComputedColumnOptions {
    /** SQL expression for the computed column (provider-agnostic as possible). */
    expression: string;
    /** Optional column name override. */
    name?: string;
    /** Whether the computed value is persisted (if supported by provider). */
    persisted?: boolean;
}
export declare function ComputedColumn(options: ComputedColumnOptions): PropertyDecorator;
//# sourceMappingURL=ComputedColumn.d.ts.map