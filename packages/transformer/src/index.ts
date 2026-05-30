// Reserved for future compile-time optimisation (P2-44 — Compiled models / AOT prep).
export type { EFCompileQueryVisitorVersion } from './visitors/EFCompileQueryVisitor';

/**
 * ts-patch entrypoint for the ts-linq compile-time transformer.
 *
 * Rewrites `.where(u => ...)`, `.having(u => ...)` and `.select(e => ...)` calls on
 * `@ts-linq/query` Queryable/TypedQueryable instances into their `*Compiled` equivalents.
 * Scope detection uses the type-brand `__tsLinqWhereTransformerBrand`.
 */

import * as ts from 'typescript';

import { extractSinkFromCtx } from './diagnostics';
import { rewriteHasQueryFilterCall } from './rewriters/HasQueryFilterRewriter';
import { rewriteSelectCall } from './rewriters/SelectRewriter';
import { rewriteCall } from './rewriters/WhereHavingRewriter';

const TARGET_METHODS = new Set(['where', 'having', 'select', 'hasQueryFilter']);

export default function tsLinqTransformer(
  program: ts.Program,
  _pluginConfig: unknown,
  _extras?: unknown
): ts.TransformerFactory<ts.SourceFile> {
  const checker = program.getTypeChecker();

  return (ctx) => (sourceFile) => {
    if (sourceFile.isDeclarationFile) return sourceFile;
    const sink = extractSinkFromCtx(ctx);

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
            // We use the original receiver for the TypeChecker above; now patch the
            // rewritten call's receiver with the visited (potentially re-rewritten) one.
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
