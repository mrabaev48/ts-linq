import * as ts from 'typescript';

import type { DiagnosticSink } from './diagnostics/DiagnosticSink';
import { rewriteHasQueryFilterCall } from './rewriters/HasQueryFilterRewriter';
import { rewriteSelectCall } from './rewriters/SelectRewriter';
import { rewriteCall } from './rewriters/WhereHavingRewriter';

/**
 * Canonical call-rewrite traversal shared by both transformer entrypoints
 * (`tsLinqTransformer` default export and `createWhereTransformer`). The entrypoints
 * are thin adapters that differ only in how they obtain the {@link DiagnosticSink};
 * the traversal, dispatch and the fragile chained-receiver re-rewrite live here once.
 */

type RewriterFn = (
  call: ts.CallExpression,
  checker: ts.TypeChecker,
  ctx: ts.TransformationContext,
  sink: DiagnosticSink | undefined
) => ts.CallExpression | null;

/**
 * Single source of truth for which receiver methods are rewritten and by which rewriter.
 * Replaces the previously duplicated `TARGET_METHODS` set + dispatch ternary; mirrors the
 * `ExpressionDispatcher.DISPATCH_MAP` pattern. The map keys ARE the set of target methods.
 */
const DISPATCH: ReadonlyMap<string, RewriterFn> = new Map<string, RewriterFn>([
  ['where', rewriteCall],
  ['having', rewriteCall],
  ['select', rewriteSelectCall],
  ['hasQueryFilter', rewriteHasQueryFilterCall]
]);

/**
 * The single implementation of the package's most error-prone AST surgery.
 *
 * After a call has been rewritten, re-visit its ORIGINAL receiver so that inner chained
 * calls (e.g. `.where().where()`) are rewritten in the same pass, then patch the rewritten
 * call's receiver with the visited (potentially re-rewritten) one.
 */
function rewriteWithVisitedReceiver(
  rewritten: ts.CallExpression,
  originalReceiver: ts.Expression,
  visit: (node: ts.Node) => ts.Node
): ts.CallExpression {
  const visitedReceiver = ts.visitNode(originalReceiver, visit) as ts.Expression;
  if (visitedReceiver === originalReceiver) return rewritten;

  // The single authorised downcast: every rewriter preserves the PropertyAccess call shape.
  const propAccess = rewritten.expression as ts.PropertyAccessExpression;
  const newPropAccess = ts.factory.updatePropertyAccessExpression(
    propAccess,
    visitedReceiver,
    propAccess.name
  );
  return ts.factory.updateCallExpression(
    rewritten,
    newPropAccess,
    rewritten.typeArguments,
    rewritten.arguments
  );
}

/**
 * Builds the `(node) => ts.Node` visitor used by both entrypoints.
 *
 * @param ctx     the active transformation context (used for `visitEachChild` and rewriters).
 * @param checker the program's TypeChecker (drives scope-guard brand detection).
 * @param sink    diagnostic sink; `undefined` falls back to stderr inside `reportDiagnostic`.
 */
export function buildVisitor(
  ctx: ts.TransformationContext,
  checker: ts.TypeChecker,
  sink: DiagnosticSink | undefined
): (node: ts.Node) => ts.Node {
  const visit = (node: ts.Node): ts.Node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const rewriter = DISPATCH.get(node.expression.name.text);
      if (rewriter !== undefined) {
        const rewritten = rewriter(node, checker, ctx, sink);
        if (rewritten !== null && rewritten !== node) {
          return rewriteWithVisitedReceiver(rewritten, node.expression.expression, visit);
        }
      }
    }
    return ts.visitEachChild(node, visit, ctx);
  };
  return visit;
}
