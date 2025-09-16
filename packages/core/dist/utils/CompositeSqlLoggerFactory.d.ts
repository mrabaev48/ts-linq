import type { SqlLogger, SqlLoggerFactory } from '../types';
/**
 * Factory that composes multiple SqlLoggerFactory instances and/or direct SqlLogger providers.
 * Returns a CompositeSqlLogger of all non-empty results for a given provider.
 */
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