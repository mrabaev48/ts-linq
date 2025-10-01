import { generateMigrationFromDiff } from './DialectMigrationSql';
/** Build TypeScript source for a Migration subclass from SchemaDiff. */
export class MigrationFileBuilder {
    static build(diff, opts) {
        const filename = `${opts.version}_${opts.className}.ts`;
        const { up, down } = generateMigrationFromDiff(diff, opts.dialect);
        const esc = (s) => s.replace(/`/g, '\\`');
        const upBody = up
            .map((sql) => `        await provider.executeNonQuery(` + '`' + esc(sql) + '`' + `);`)
            .join('\n');
        const downBody = (down.length ? down : ['// no-op'])
            .map((sql) => sql.startsWith('//')
            ? `        ${sql}`
            : `        await provider.executeNonQuery(` + '`' + esc(sql) + '`' + `);`)
            .join('\n');
        const source = `import { Migration } from '../migrations/Migration';\nimport { DatabaseProvider } from '../providers/DatabaseProvider';\n\nexport class ${opts.className} extends Migration {\n  protected get name() { return '${opts.className}'; }\n  protected get version() { return '${opts.version}'; }\n  constructor(private provider: DatabaseProvider) { super(); }\n  public async up(): Promise<void> {\n    const provider = this.provider;\n${upBody}\n  }\n  public async down(): Promise<void> {\n    const provider = this.provider;\n${downBody}\n  }\n}\n`;
        return { filename, source };
    }
}
//# sourceMappingURL=MigrationFileBuilder.js.map