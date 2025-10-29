import type { DatabaseProvider } from '@ts-linq/core';
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
}
//# sourceMappingURL=DiffMigrationGenerator.d.ts.map