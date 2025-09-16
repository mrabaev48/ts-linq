import type { DatabaseProvider } from '../DatabaseProvider';
export interface MigrationStep {
    sql: string;
}
/**
 * Minimal diff generator (SQLite):
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 *
 * Note: For complex ALTERs SQLite often requires table rebuild; here we handle simple adds.
 */
export declare class DiffMigrationGenerator {
    private provider;
    constructor(provider: DatabaseProvider);
    generate(): Promise<MigrationStep[]>;
    private buildCreateTableSql;
    private mapType;
    private normalizeType;
    private formatValue;
}
//# sourceMappingURL=DiffMigrationGenerator.d.ts.map