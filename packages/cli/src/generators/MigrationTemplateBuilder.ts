export class MigrationTemplateBuilder {
  public build(name: string, version: string): string {
    return `import { Migration } from '@ts-linq/core';\n\nexport class ${name} extends Migration {\n  protected get name() { return '${name}'; }\n  protected get version() { return '${version}'; }\n  public async up(): Promise<void> { }\n  public async down(): Promise<void> { }\n}\n`;
  }
}
