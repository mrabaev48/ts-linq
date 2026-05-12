import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { SchemaSnapshotBuilder } from './SchemaSnapshot';
import type { SchemaSnapshot, ColumnDef } from './DiffTypes';
import type { Dialect } from './Dialect';
import { SchemaInspectionService } from './services/SchemaInspectionService';
import { StepPlanner } from './services/StepPlanner';

export interface MigrationStep {
  sql: string;
}

/**
 * Minimal diff generator:
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 */
export class DiffMigrationGenerator {
  constructor(private provider: DatabaseProvider) {}

  public async generate(): Promise<MigrationStep[]> {
    const expected: SchemaSnapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const label = (this.provider.providerLabel || 'postgresql') as Dialect;
    const inspection = new SchemaInspectionService();
    const actual: SchemaSnapshot = await inspection.buildActualSnapshot(this.provider, expected);
    const planner = new StepPlanner();
    const upSql = planner.plan(expected, actual, label);
    return upSql.map((sql) => ({ sql }));
  }
}
