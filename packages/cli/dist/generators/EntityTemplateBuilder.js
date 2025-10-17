"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityTemplateBuilder = void 0;
class EntityTemplateBuilder {
    buildFromColumns(className, table, defs) {
        const lines = [];
        lines.push(`import { Entity, Column, PrimaryKey } from '@ts-linq/core';`);
        lines.push('');
        lines.push(`@Entity({ name: '${table}' })`);
        lines.push(`export class ${className} {`);
        for (const col of defs) {
            const tsType = this.mapTsType(col.ormType) + (col.nullable ? ' | null' : '');
            const opts = [];
            opts.push(`type: '${col.ormType}'`);
            if (!col.nullable)
                opts.push('nullable: false');
            const deco = col.isPrimary ? 'PrimaryKey' : 'Column';
            lines.push(`  @${deco}({ ${opts.join(', ')} })`);
            lines.push(`  public ${col.name}!: ${tsType};`);
            lines.push('');
        }
        lines.push('}');
        return lines.join('\n');
    }
    buildDefault(className, table) {
        return `import { Entity, Column, PrimaryKey } from '@ts-linq/core';

@Entity({ name: '${table}' })
export class ${className} {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  public id!: number;

  @Column({ type: 'TEXT', nullable: false })
  public name!: string;

  @Column({ type: 'DATETIME', nullable: false })
  public createdAt!: Date;
}
`;
    }
    mapTsType(colType) {
        switch (colType) {
            case 'INTEGER':
            case 'REAL':
            case 'DECIMAL':
                return 'number';
            case 'BOOLEAN':
                return 'boolean';
            case 'DATETIME':
                return 'Date';
            case 'BLOB':
                return 'Buffer';
            case 'UUID':
                return 'string';
            case 'JSON':
            case 'JSONB':
                return 'unknown';
            default:
                return 'string';
        }
    }
}
exports.EntityTemplateBuilder = EntityTemplateBuilder;
//# sourceMappingURL=EntityTemplateBuilder.js.map