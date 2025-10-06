import type { Dialect } from './DialectMigrationSql';
import type { SchemaDiff } from './DiffTypes';
/** Options for generating a TypeScript Migration class source. */
export interface MigrationTemplateOptions {
  className: string;
  version: string;
  dialect: Dialect;
}
/**
 * Generate TypeScript source for a Migration subclass from a SchemaDiff.
 * Produces a single file with up()/down() executing the generated SQL statements.
 */
export declare function generateMigrationClassSource(
  diff: SchemaDiff,
  opts: MigrationTemplateOptions
): string;
//# sourceMappingURL=MigrationTemplate.d.ts.map
