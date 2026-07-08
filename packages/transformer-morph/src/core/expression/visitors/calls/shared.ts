import * as ts from 'typescript';

import { num, str } from '../../../nodes/builders';
import { buildPropertyNode, collectPropertyChain } from '../../../nodes/PropertyChain';
import type { TransformContext } from '../../TransformContext';

/**
 * A single call-pattern handler in the {@link CallVisitor} chain of responsibility.
 *
 * Returns the rewritten AST node when the handler recognises (and commits to) the
 * call shape, or `null` when the call does not match this pattern and the next
 * handler should be tried.
 */
export type CallHandler = (
  node: ts.CallExpression,
  tctx: TransformContext,
  depth: number
) => ts.Expression | null;

/** Entity string methods rewritten into a `MethodNode` (Pattern A). */
export const STRING_METHODS = new Set(['includes', 'startsWith', 'endsWith']);

/** Recognised `EF.functions.*` markers rewritten into an `EfFunctionNode` (Pattern D). */
export const EF_FUNCTIONS = new Set([
  'like',
  'iLike',
  'random',
  'dateDiffDay',
  'dateDiffMonth',
  'greatest',
  'least',
  'stDev',
  'variance'
]);

/** True when `callee` is the `EF.functions.<method>` member access shape. */
export function isEfFunctionsCall(callee: ts.PropertyAccessExpression): boolean {
  if (!ts.isPropertyAccessExpression(callee.expression)) return false;
  const efFunctionsAccess = callee.expression;
  return (
    ts.isIdentifier(efFunctionsAccess.expression) &&
    efFunctionsAccess.expression.text === 'EF' &&
    efFunctionsAccess.name.text === 'functions'
  );
}

/**
 * Extract an entity `PropertyNode` from an argument expression, or `null` when the
 * argument is not a property-access chain rooted at the lambda parameter.
 */
export function extractPropertyNode(
  argNode: ts.Expression,
  paramName: string
): ts.ObjectLiteralExpression | null {
  if (!ts.isPropertyAccessExpression(argNode)) return null;
  const chain = collectPropertyChain(argNode);
  if (chain === null || chain.root !== paramName) return null;
  return buildPropertyNode(chain.segments, chain.hasOptional);
}

/**
 * The single source of truth for converting a TypeScript literal node into its bare
 * AST literal value expression. Used by both the array-`includes` (IN) path and the
 * `EF.functions.*` argument path.
 *
 * Returns `null` when `node` is not a supported literal form, letting each caller
 * decide its own fallback (an `unsupported` sentinel for the array path, a captured
 * `parameterRef` for the EF path).
 */
export function literalToAstNode(node: ts.Expression): ts.Expression | null {
  if (ts.isStringLiteral(node)) return str(node.text);
  if (ts.isNumericLiteral(node)) return num(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return ts.factory.createTrue();
  if (node.kind === ts.SyntaxKind.FalseKeyword) return ts.factory.createFalse();
  if (node.kind === ts.SyntaxKind.NullKeyword) return ts.factory.createNull();
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      ts.factory.createNumericLiteral(node.operand.text)
    );
  }
  return null;
}
