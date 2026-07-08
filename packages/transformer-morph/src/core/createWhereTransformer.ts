import * as ts from 'typescript';

import { buildVisitor } from './CallRewriteVisitor';
import type { DiagnosticSink } from './diagnostics/DiagnosticSink';

/**
 * The canonical program-level transformer factory of this package.
 *
 * The `sink` parameter is structurally compatible with `{ addDiagnostic: fn }` —
 * callers that pass `{ addDiagnostic }` work without changes. Unlike the ts-patch
 * entrypoint of `@ts-linq/transformer`, the {@link DiagnosticSink} is always injected
 * explicitly by the host — there is no augmented TransformationContext to read it from.
 *
 * Thin adapter over the shared {@link buildVisitor}, which owns the traversal,
 * dispatch and chained-receiver re-rewrite.
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
