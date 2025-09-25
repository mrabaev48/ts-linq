import type { SqlLogger, SqlLoggerFactory } from '@ts-linq/core';
export declare class CompositeSqlLoggerFactory implements SqlLoggerFactory {
    private readonly factories;
    private readonly statics;
    constructor(options?: {
        factories?: Array<SqlLoggerFactory | undefined>;
        loggers?: Array<SqlLogger | undefined>;
    });
    create(provider: 'sqlite' | 'mysql' | 'postgresql' | 'mssql' | string): SqlLogger | undefined;
}
//# sourceMappingURL=CompositeSqlLoggerFactory.d.ts.map