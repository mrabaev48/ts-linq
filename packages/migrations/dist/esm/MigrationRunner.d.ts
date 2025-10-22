import type { DatabaseProvider } from '@ts-linq/core';
import type { Migration } from './Migration';
/**
 * A record stored in the migrations table representing an applied migration.
 */
export interface MigrationRecord {
    version: string;
    name: string;
    appliedAt: Date;
}
/**
 * Executes pending migrations in order and can roll back to a target version.
 */
export declare class MigrationRunner {
    private _provider;
    private _migrations;
    constructor(provider: DatabaseProvider);
    /** Register a migration to be considered during `migrate()`. */
    addMigration(migration: Migration): void;
    /** Ensure the migrations bookkeeping table exists. */
    ensureMigrationTableExists(): Promise<void>;
    /** Read the list of applied migrations from the database. */
    getAppliedMigrations(): Promise<MigrationRecord[]>;
    /** Apply all pending migrations in order. */
    migrate(): Promise<void>;
    /** Roll back applied migrations down to (but not including) targetVersion. */
    rollback(targetVersion?: string): Promise<void>;
}
//# sourceMappingURL=MigrationRunner.d.ts.map