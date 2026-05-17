import type * as ts from 'typescript';

import tsLinqTransformer from './index';

/** Wrapper around the default transformer that allows injecting a diagnostic collector. */
export function createWhereTransformer(
  program: ts.Program,
  extraCtx: { addDiagnostic: (d: ts.Diagnostic) => void }
): ts.TransformerFactory<ts.SourceFile> {
  const factory = tsLinqTransformer(program, null, null);
  return (ctx) => {
    const augmented = Object.assign(ctx, { addDiagnostic: extraCtx.addDiagnostic });
    return factory(augmented);
  };
}
