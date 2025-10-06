import type { SchemaDiff } from './DiffTypes';
import type { Dialect } from './Dialect';
export type { Dialect };
export declare function generateMigrationFromDiff(
  diff: SchemaDiff,
  dialect: Dialect
): {
  up: string[];
  down: string[];
};
//# sourceMappingURL=DialectMigrationSql.d.ts.map
