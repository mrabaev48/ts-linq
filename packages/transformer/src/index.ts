import * as ts from 'typescript';

import { createWhereTransformer } from './WhereTransformer';

/**
 * ts-patch entrypoint.
 *
 * The plugin rewrites supported `where(...)` / `having(...)` calls from `@ts-linq/query`
 * into `whereCompiled({ ast, parameters })` / `havingCompiled({ ... })`.
 */
export default function tsLinqTransformer(
  program: ts.Program,
  pluginConfig: unknown,
  extras?: unknown
): ts.TransformerFactory<ts.SourceFile> {
  void pluginConfig;
  return createWhereTransformer(program, extras);
}

