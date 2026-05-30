import * as ts from 'typescript';

import type { DiagnosticSink } from './diagnostics/DiagnosticSink';
import { rewriteHasQueryFilterCall } from './rewriters/HasQueryFilterRewriter';
import { rewriteSelectCall } from './rewriters/SelectRewriter';
import { rewriteCall } from './rewriters/WhereHavingRewriter';

const TARGET_METHODS = new Set(['where', 'having', 'select', 'hasQueryFilter']);

/**
 * Wrapper around the default transformer that allows injecting a diagnostic collector.
 *
 * The `sink` parameter is structurally compatible with `{ addDiagnostic: fn }` —
 * existing callers that pass `{ addDiagnostic }` continue to work without changes.
 * No Object.assign mutation of TransformationContext.
 */
export function createWhereTransformer(
  program: ts.Program,
  sink: DiagnosticSink
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();

  return (ctx) => (sourceFile) => {
    if (sourceFile.isDeclarationFile) return sourceFile;

    const visit = (node: ts.Node): ts.Node => {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr) && TARGET_METHODS.has(expr.name.text)) {
          const rewritten =
            expr.name.text === 'select'
              ? rewriteSelectCall(node, checker, ctx, sink)
              : expr.name.text === 'hasQueryFilter'
                ? rewriteHasQueryFilterCall(node, checker, ctx, sink)
                : rewriteCall(node, checker, ctx, sink);
          if (rewritten !== null && rewritten !== node) {
            // Visit the original receiver AFTER rewriting this call so that inner
            // chained calls (e.g. .where().where()) also get rewritten in this pass.
            const originalReceiver = expr.expression;
            const visitedReceiver = ts.visitNode(originalReceiver, visit) as ts.Expression;
            if (visitedReceiver !== originalReceiver) {
              const newPropAccess = ts.factory.updatePropertyAccessExpression(
                rewritten.expression as ts.PropertyAccessExpression,
                visitedReceiver,
                (rewritten.expression as ts.PropertyAccessExpression).name
              );
              return ts.factory.updateCallExpression(
                rewritten,
                newPropAccess,
                rewritten.typeArguments,
                rewritten.arguments
              );
            }
            return rewritten;
          }
        }
      }
      return ts.visitEachChild(node, visit, ctx);
    };

    return ts.visitEachChild(sourceFile, visit, ctx);
  };
}
