"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMigrationClassSource = generateMigrationClassSource;
const DialectMigrationSql_1 = require("./DialectMigrationSql");
/** Escape a string literal for inclusion in TS template. */
function escapeBackticks(source) {
    return source.replace(/`/g, '\\`');
}
/**
 * Generate TypeScript source for a Migration subclass from a SchemaDiff.
 * Produces a single file with up()/down() executing the generated SQL statements.
 */
function generateMigrationClassSource(diff, opts) {
    const { up, down } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, opts.dialect);
    const upBody = up
        .map((sql) => `        await provider.executeNonQuery(` + '`' + escapeBackticks(sql) + '`' + `);`)
        .join('\n');
    const downBody = down.length > 0
        ? down
            .map((sql) => `        await provider.executeNonQuery(` + '`' + escapeBackticks(sql) + '`' + `);`)
            .join('\n')
        : '        // no-op';
    return `import { Migration } from '../migrations/Migration';\nimport { DatabaseProvider } from '../providers/DatabaseProvider';\n\nexport class ${opts.className} extends Migration {\n  protected get name() { return '${opts.className}'; }\n  protected get version() { return '${opts.version}'; }\n  constructor(private provider: DatabaseProvider) { super(); }\n  public async up(): Promise<void> {\n${upBody}\n  }\n  public async down(): Promise<void> {\n${downBody}\n  }\n}\n`;
}
//# sourceMappingURL=MigrationTemplate.js.map