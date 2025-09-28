import type { SchemaDiff } from './DiffTypes';
export type Dialect = 'sqlite' | 'postgresql' | 'mysql' | 'mssql';
export declare function generateMigrationFromDiff(
  diff: SchemaDiff,
  dialect: Dialect
): {
  up: string[];
  down: string[];
};
//# sourceMappingURL=DialectMigrationSql.d.ts.map
