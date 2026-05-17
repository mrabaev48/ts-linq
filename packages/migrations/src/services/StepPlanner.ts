import type { Dialect } from '../Dialect';
import { generateMigrationFromDiff } from '../DialectMigrationSql';
import type { SchemaSnapshot } from '../DiffTypes';
import { compareSchemas } from '../SchemaComparator';

export class StepPlanner {
  public plan(expected: SchemaSnapshot, actual: SchemaSnapshot, dialect: Dialect): string[] {
    const diff = compareSchemas(expected, actual);
    const rendered = generateMigrationFromDiff(diff, dialect);
    return rendered.up;
  }
}
