import type { DatabaseIndexModel, DatabaseTableModel } from '@ts-linq/types';

import type { NormalizerOptions } from '../name-normalizer';
import { toClassName, toNavigationPropertyName, toPropertyName } from '../name-normalizer';

function mapTsType(ormType: string, nullable: boolean): string {
  let base: string;
  switch (ormType) {
    case 'INTEGER':
    case 'REAL':
    case 'DECIMAL':
      base = 'number';
      break;
    case 'BOOLEAN':
      base = 'boolean';
      break;
    case 'DATETIME':
      base = 'Date';
      break;
    case 'BLOB':
      base = 'Buffer';
      break;
    case 'UUID':
      base = 'string';
      break;
    case 'JSON':
    case 'JSONB':
      base = 'unknown';
      break;
    default:
      base = 'string';
  }
  return nullable ? `${base} | null` : base;
}

function buildColumnDecorator(
  isPrimary: boolean,
  ormType: string,
  nullable: boolean,
  isIdentity: boolean,
  defaultExpression?: string
): string {
  const opts: string[] = [`type: '${ormType}'`];
  if (!nullable) opts.push('nullable: false');
  if (isIdentity) opts.push('autoIncrement: true');
  if (defaultExpression != null)
    opts.push(`defaultExpression: '${defaultExpression.replace(/'/g, "\\'")}'`);
  const deco = isPrimary ? 'PrimaryKey' : 'Column';
  return `  @${deco}({ ${opts.join(', ')} })`;
}

function buildIndexDecorators(indexes: DatabaseIndexModel[]): string[] {
  return indexes.map((idx) => {
    const cols = idx.columns.map((c) => `'${c}'`).join(', ');
    const opts: string[] = [`[${cols}]`];
    if (idx.unique) opts.push('{ unique: true }');
    if (idx.where) opts.push(`{ where: '${idx.where.replace(/'/g, "\\'")}' }`);
    return `@Index(${opts.join(', ')})`;
  });
}

function buildRelationDecorators(
  table: DatabaseTableModel,
  allTables: DatabaseTableModel[],
  opts: NormalizerOptions
): Array<{ decorator: string; field: string; tsType: string }> {
  const result: Array<{ decorator: string; field: string; tsType: string }> = [];
  for (const fk of table.foreignKeys) {
    const refClass = toClassName(fk.referencedTable, opts);
    const navProp = toNavigationPropertyName(refClass, fk.columns);
    const fkCols = fk.columns.map((c) => `'${toPropertyName(c, opts)}'`).join(', ');
    result.push({
      decorator: `  @ManyToOne(() => ${refClass}, { foreignKey: [${fkCols}] })`,
      field: navProp,
      tsType: refClass
    });
  }

  // Reverse: one-to-many from other tables that reference this table
  for (const other of allTables) {
    if (other.name === table.name) continue;
    for (const fk of other.foreignKeys) {
      if (fk.referencedTable === table.name) {
        const otherClass = toClassName(other.name, opts);
        const navProp = toPluralNavProp(otherClass);
        result.push({
          decorator: `  @OneToMany(() => ${otherClass}, (x) => x.${toNavigationPropertyName(toClassName(table.name, opts), fk.columns)})`,
          field: navProp,
          tsType: `${otherClass}[]`
        });
      }
    }
  }
  return result;
}

function toPluralNavProp(className: string): string {
  const lower = className.charAt(0).toLowerCase() + className.slice(1);
  if (lower.endsWith('s')) return lower;
  if (lower.endsWith('y')) return lower.slice(0, -1) + 'ies';
  return lower + 's';
}

export function renderEntityTemplate(
  table: DatabaseTableModel,
  allTables: DatabaseTableModel[],
  normOpts: NormalizerOptions
): string {
  const className = toClassName(table.name, normOpts);
  const indexDecos = buildIndexDecorators(table.indexes);
  const relations = buildRelationDecorators(table, allTables, normOpts);

  const hasRelations = relations.length > 0;
  const hasIndexes = indexDecos.length > 0;

  const imports = ['Entity', 'Column', 'PrimaryKey'];
  if (hasIndexes) imports.push('Index');
  if (hasRelations) {
    if (relations.some((r) => r.decorator.includes('@ManyToOne'))) imports.push('ManyToOne');
    if (relations.some((r) => r.decorator.includes('@OneToMany'))) imports.push('OneToMany');
  }

  const refClasses = new Set(
    relations.map((r) => r.tsType.replace('[]', '')).filter((t) => t !== className)
  );

  const lines: string[] = [];
  lines.push(`import { ${imports.join(', ')} } from '@ts-linq/core';`);
  for (const ref of refClasses) {
    lines.push(`import { ${ref} } from './${ref}';`);
  }
  lines.push('');

  for (const deco of indexDecos) {
    lines.push(deco);
  }
  lines.push(`@Entity({ name: '${table.name}' })`);
  lines.push(`export class ${className} {`);

  for (const col of table.columns) {
    const propName = toPropertyName(col.name, normOpts);
    const tsType = mapTsType(col.ormType, col.nullable);
    lines.push(
      buildColumnDecorator(
        col.isPrimary,
        col.ormType,
        col.nullable,
        col.isIdentity,
        col.defaultExpression
      )
    );
    lines.push(`  public ${propName}!: ${tsType};`);
    lines.push('');
  }

  for (const rel of relations) {
    lines.push(rel.decorator);
    lines.push(`  public ${rel.field}!: ${rel.tsType};`);
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}
