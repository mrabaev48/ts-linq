import type { DatabaseProvider } from '../DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { SchemaSnapshotBuilder } from './SchemaSnapshot';
import type { SchemaSnapshot, ColumnDef } from './DiffTypes';
import { SchemaInspectionService } from './services/SchemaInspectionService';
import { StepPlanner } from './services/StepPlanner';

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
export class DiffMigrationGenerator {
  constructor(private provider: DatabaseProvider) {}

  public async generate(): Promise<MigrationStep[]> {
    const expected: SchemaSnapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const label = this.provider.providerLabel as 'sqlite' | 'postgresql' | 'mysql' | 'mssql';
    const inspection = new SchemaInspectionService();
    const actual: SchemaSnapshot = await inspection.buildActualSnapshot(this.provider, expected);
    const planner = new StepPlanner();
    const upSql = planner.plan(expected, actual, label);
    return upSql.map((sql) => ({ sql }));
  }
}
