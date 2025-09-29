"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationTemplateBuilder = void 0;
class MigrationTemplateBuilder {
    build(name, version) {
        return `import { Migration } from '@ts-linq/core';\n\nexport class ${name} extends Migration {\n  protected get name() { return '${name}'; }\n  protected get version() { return '${version}'; }\n  public async up(): Promise<void> { }\n  public async down(): Promise<void> { }\n}\n`;
    }
}
exports.MigrationTemplateBuilder = MigrationTemplateBuilder;
//# sourceMappingURL=MigrationTemplateBuilder.js.map