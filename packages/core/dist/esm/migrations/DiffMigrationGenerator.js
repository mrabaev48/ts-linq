import { SchemaSnapshotBuilder } from './SchemaSnapshot';
import { SchemaInspectionService } from './services/SchemaInspectionService';
import { StepPlanner } from './services/StepPlanner';
/**
 * Minimal diff generator (SQLite):
 * - Create table if missing
 * - Add missing non-nullable columns with default (when possible)
 *
 * Note: For complex ALTERs SQLite often requires table rebuild; here we handle simple adds.
 */
export class DiffMigrationGenerator {
  constructor(provider) {
    this.provider = provider;
  }
  async generate() {
    const expected = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    const label = this.provider.providerLabel;
    const inspection = new SchemaInspectionService();
    const actual = await inspection.buildActualSnapshot(this.provider, expected);
    const planner = new StepPlanner();
    const upSql = planner.plan(expected, actual, label);
    return upSql.map((sql) => ({ sql }));
  }
}
//# sourceMappingURL=DiffMigrationGenerator.js.map
