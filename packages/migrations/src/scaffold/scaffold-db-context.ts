import type { DatabaseProvider } from '@ts-linq/core';
import type { DbIntrospector, ScaffoldOptions } from '@ts-linq/types';
import * as fs from 'fs';
import * as path from 'path';

import type { NormalizerOptions } from './name-normalizer';
import { toClassName } from './name-normalizer';
import { renderDbContextTemplate } from './templates/db-context.tpl';
import { renderEntityTemplate } from './templates/entity.tpl';

export type { ScaffoldOptions } from '@ts-linq/types';

/**
 * Reverse-engineers a connected database into entity TypeScript files + a DbContext.
 *
 * The caller is responsible for connecting and disconnecting the provider.
 * The introspector must correspond to the same dialect as the provider.
 */
export async function scaffoldDbContext(
  provider: DatabaseProvider,
  introspector: DbIntrospector,
  opts: ScaffoldOptions
): Promise<void> {
  const {
    outputDir,
    contextName = 'AppContext',
    useDatabaseNames = false,
    pluralize = true,
    schema,
    tables: tableFilter
  } = opts;

  const normOpts: NormalizerOptions = { useDatabaseNames, pluralize };
  const absOutDir = path.resolve(process.cwd(), outputDir);
  fs.mkdirSync(absOutDir, { recursive: true });

  let model = await introspector.introspect(schema);

  if (tableFilter && tableFilter.length > 0) {
    const filterSet = new Set(tableFilter);
    model = { tables: model.tables.filter((t) => filterSet.has(t.name)) };
  }

  for (const table of model.tables) {
    const className = toClassName(table.name, normOpts);
    const content = renderEntityTemplate(table, model.tables, normOpts);
    const filePath = path.join(absOutDir, `${className}.ts`);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  const contextContent = renderDbContextTemplate(model.tables, contextName, normOpts);
  const contextFilePath = path.join(absOutDir, `${contextName}.ts`);
  fs.writeFileSync(contextFilePath, contextContent, 'utf8');

  // Suppress unused parameter warning — provider is passed for potential future use
  void provider;
}
