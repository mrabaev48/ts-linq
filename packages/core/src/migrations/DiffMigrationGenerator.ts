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

  private buildCreateTableSql(table: string, columns: ColumnDef[], primaryKeys: string[]): string {
    const colDefs = columns.map((c) => {
      const type = this.mapType(c.type);
      const nn = c.nullable ? '' : ' NOT NULL';
      const def =
        c.defaultValue !== undefined ? ` DEFAULT ${this.formatValue(c.defaultValue)}` : '';
      const colName = c.name;
      return `${colName} ${type}${nn}${def}`;
    });
    if (Array.isArray(primaryKeys) && primaryKeys.length > 0) {
      colDefs.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
    }
    return `CREATE TABLE IF NOT EXISTS ${table} (${colDefs.join(', ')})`;
  }

  private formatValue(v: unknown): string {
    if (v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  }
}
