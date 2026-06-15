import * as ts from 'typescript';

import { makeUnsupported } from '../nodes/builders';
import { dispatch } from './ExpressionDispatcher';
import type { TransformContext } from './TransformContext';

export const MAX_DEPTH = 64;

export function transformExpression(
  node: ts.Expression,
  tctx: TransformContext,
  depth = 0
): ts.Expression {
  if (depth > MAX_DEPTH)
    return makeUnsupported(node, { sink: tctx.sink, methodName: tctx.methodName });

  // Parenthesised — transparent unwrap (does not consume a depth level)
  if (ts.isParenthesizedExpression(node)) {
    return transformExpression(node.expression, tctx, depth);
  }

  // Optional call (unsupported)
  if (
    ts.isCallExpression(node) &&
    (node as ts.CallExpression & { questionDotToken?: unknown }).questionDotToken !== undefined
  ) {
    return makeUnsupported(node, { sink: tctx.sink, methodName: tctx.methodName });
  }

  return dispatch(node, tctx, depth);
}
