import * as ts from 'typescript';

import { makeArray, makeObject, makeUnsupported, prop, str } from '../../../nodes/builders';
import type { TransformContext } from '../../TransformContext';
import { extractPropertyNode, literalToAstNode } from './shared';

/**
 * Pattern B — array-literal `.includes` rewritten into an `InNode` with inline values.
 *
 * Example: `["admin","mod"].includes(u.role)`.
 *
 * Commits as soon as the receiver is an array literal and the method is `includes`:
 * a non-property argument then yields an `unsupported` sentinel (never a fall-through).
 */
export function tryVisit(
  node: ts.CallExpression,
  tctx: TransformContext,
  _depth: number
): ts.Expression | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;

  const callee = node.expression;
  const receiver = callee.expression;
  const method = callee.name.text;
  const arg0 = node.arguments[0] as ts.Expression | undefined;

  if (!(method === 'includes' && ts.isArrayLiteralExpression(receiver) && arg0 !== undefined)) {
    return null;
  }

  const propExpr = extractPropertyNode(arg0, tctx.paramName);
  if (propExpr === null) {
    return makeUnsupported(arg0, { sink: tctx.sink, methodName: tctx.methodName });
  }

  const valueLiterals = receiver.elements.map(
    (el) =>
      literalToAstNode(el) ?? makeUnsupported(el, { sink: tctx.sink, methodName: tctx.methodName })
  );

  return makeObject([
    prop('type', str('in')),
    prop('property', propExpr),
    prop(
      'values',
      makeArray(
        valueLiterals.map((v) => makeObject([prop('type', str('literal')), prop('value', v)]))
      )
    )
  ]);
}
