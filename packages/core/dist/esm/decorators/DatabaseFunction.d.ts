export declare function DatabaseFunction(expression: string | {
    sqlite?: string;
    postgresql?: string;
    mysql?: string;
    mssql?: string;
    default?: string;
}, nameOverride?: string): (_initialValue: unknown, context: ClassFieldDecoratorContext) => void;
//# sourceMappingURL=DatabaseFunction.d.ts.map