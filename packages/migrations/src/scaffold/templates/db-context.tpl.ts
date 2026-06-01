import type { DatabaseTableModel } from '@ts-linq/types';

import type { NormalizerOptions } from '../name-normalizer';
import { toClassName, toContextPropertyName } from '../name-normalizer';

export function renderDbContextTemplate(
  tables: DatabaseTableModel[],
  contextName: string,
  normOpts: NormalizerOptions
): string {
  const entityNames = tables.map((t) => toClassName(t.name, normOpts));
  const propNames = tables.map((t) => toContextPropertyName(t.name, normOpts));

  const lines: string[] = [];
  lines.push(`import { DbContext, DbSet } from '@ts-linq/core';`);
  for (const name of entityNames) {
    lines.push(`import { ${name} } from './${name}';`);
  }
  lines.push('');
  lines.push(`export class ${contextName} extends DbContext {`);
  for (let i = 0; i < tables.length; i++) {
    lines.push(`  public ${propNames[i]}!: DbSet<${entityNames[i]}>;`);
  }
  lines.push('}');
  return lines.join('\n');
}
