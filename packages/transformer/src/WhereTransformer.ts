import * as ts from 'typescript';

import { buildVisitor } from './CallRewriteVisitor';
import type { DiagnosticSink } from './diagnostics/DiagnosticSink';

/**
 * Wrapper around the default transformer that allows injecting a diagnostic collector.
 *
 * The `sink` parameter is structurally compatible with `{ addDiagnostic: fn }` —
 * existing callers that pass `{ addDiagnostic }` continue to work without changes.
 * No Object.assign mutation of TransformationContext.
 *
 * Thin adapter over the shared {@link buildVisitor}: differs from the `tsLinqTransformer`
 * default export only in that the {@link DiagnosticSink} is injected rather than read from ctx.
 */
export function createWhereTransformer(
  program: ts.Program,
  sink: DiagnosticSink
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();

  return (ctx) => (sourceFile) => {
    if (sourceFile.isDeclarationFile) return sourceFile;
    return ts.visitEachChild(sourceFile, buildVisitor(ctx, checker, sink), ctx);
  };
}
