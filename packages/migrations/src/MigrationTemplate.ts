import type { Dialect } from './DialectMigrationSql';
import { generateMigrationFromDiff } from './DialectMigrationSql';
import type { SchemaDiff } from './DiffTypes';

/** Options for generating a TypeScript Migration class source. */
export interface MigrationTemplateOptions {
  className: string;
  version: string;
  dialect: Dialect;
}

/** Escape a string literal for inclusion in TS template. */
function escapeBackticks(source: string): string {
  return source.replace(/`/g, '\\`');
}

/**
 * Generate TypeScript source for a Migration subclass from a SchemaDiff.
 * Produces a single file with up()/down() executing the generated SQL statements.
 */
export function generateMigrationClassSource(
  diff: SchemaDiff,
  opts: MigrationTemplateOptions
): string {
  const { up, down } = generateMigrationFromDiff(diff, opts.dialect);
  const upBody = up
    .map(
      (sql) => `        await provider.executeNonQuery(` + '`' + escapeBackticks(sql) + '`' + `);`
    )
    .join('\n');
  const downBody =
    down.length > 0
      ? down
          .map(
            (sql) =>
              `        await provider.executeNonQuery(` + '`' + escapeBackticks(sql) + '`' + `);`
          )
          .join('\n')
      : '        // no-op';
  return `import { Migration } from '../migrations/Migration';\nimport { DatabaseProvider } from '../providers/DatabaseProvider';\n\nexport class ${opts.className} extends Migration {\n  protected get name() { return '${opts.className}'; }\n  protected get version() { return '${opts.version}'; }\n  constructor(private provider: DatabaseProvider) { super(); }\n  public async up(): Promise<void> {\n${upBody}\n  }\n  public async down(): Promise<void> {\n${downBody}\n  }\n}\n`;
}
