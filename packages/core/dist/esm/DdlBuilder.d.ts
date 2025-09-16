import type { EntityMetadata } from './types';
import type { DdlStrategy } from './DdlStrategy';
/**
 * Small facade over a DdlStrategy to generate CREATE TABLE and INDEX statements
 * in a consistent, testable way.
 */
export declare class DdlBuilder {
    private readonly strategy;
    constructor(strategy: DdlStrategy);
    buildCreateTableSql(metadata: EntityMetadata): string;
    buildCreateIndexesSql(metadata: EntityMetadata): string[];
    buildAll(metadata: EntityMetadata): {
        tableSql: string;
        indexSqls: string[];
    };
}
//# sourceMappingURL=DdlBuilder.d.ts.map