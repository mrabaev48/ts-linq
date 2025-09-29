import type { SchemaDiff } from './DiffTypes';
import type { Dialect } from './DialectMigrationSql';
export interface MigrationFileOptions {
  className: string;
  version: string;
  dialect: Dialect;
}
/** Build TypeScript source for a Migration subclass from SchemaDiff. */
export declare class MigrationFileBuilder {
  static build(
    diff: SchemaDiff,
    opts: MigrationFileOptions
  ): {
    filename: string;
    source: string;
  };
}
//# sourceMappingURL=MigrationFileBuilder.d.ts.map
