import * as ts from 'typescript';

import { makeObject, makeUnsupported, num, prop, str } from '../../../nodes/builders';
import type { TransformContext } from '../../TransformContext';
import { extractPropertyNode } from './shared';

/**
 * Pattern C — identifier `.includes` rewritten into an `InNode` with a captured
 * `valuesRef`, e.g. `roles.includes(u.role)` where `roles` is an external variable.
 *
 * The receiver identifier is captured into {@link TransformContext.parameters}; its
 * array position becomes the `valuesRef` index.
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

  if (
    !(
      method === 'includes' &&
      ts.isIdentifier(receiver) &&
      receiver.text !== tctx.paramName &&
      arg0 !== undefined
    )
  ) {
    return null;
  }

  const propExpr = extractPropertyNode(arg0, tctx.paramName);
  if (propExpr === null) {
    return makeUnsupported(arg0, { sink: tctx.sink, methodName: tctx.methodName });
  }

  const idx = tctx.parameters.length;
  tctx.parameters.push(receiver);

  return makeObject([
    prop('type', str('in')),
    prop('property', propExpr),
    prop('valuesRef', num(idx))
  ]);
}
