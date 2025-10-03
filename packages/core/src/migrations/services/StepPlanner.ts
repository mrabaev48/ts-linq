import type { SchemaSnapshot } from '../DiffTypes';
import { compareSchemas } from '../DiffTypes';
import { generateMigrationFromDiff } from '../DialectMigrationSql';

export class StepPlanner {
  public plan(
    expected: SchemaSnapshot,
    actual: SchemaSnapshot,
    dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql'
  ): string[] {
    const diff = compareSchemas(expected, actual);
    const rendered = generateMigrationFromDiff(diff, dialect);
    return rendered.up;
  }
}
