import { compareSchemas } from '../DiffTypes';
import { generateMigrationFromDiff } from '../DialectMigrationSql';
export class StepPlanner {
  plan(expected, actual, dialect) {
    const diff = compareSchemas(expected, actual);
    const rendered = generateMigrationFromDiff(diff, dialect);
    return rendered.up;
  }
}
//# sourceMappingURL=StepPlanner.js.map
