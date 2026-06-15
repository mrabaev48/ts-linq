import * as ts from 'typescript';

import { makeArray, makeObject, makeUnsupported, prop, str } from '../../../nodes/builders';
import { buildPropertyNode, collectPropertyChain } from '../../../nodes/PropertyChain';
import type { TransformContext } from '../../TransformContext';
import { STRING_METHODS } from './shared';

/**
 * Pattern A — entity string methods (`.includes` / `.startsWith` / `.endsWith`)
 * rewritten into a `MethodNode`, e.g. `u.name.includes("foo")`.
 *
 * Commits once the method is a known string method and the receiver is a property
 * access; a receiver chain not rooted at the lambda parameter yields an
 * `unsupported` sentinel.
 */
export function tryVisit(
  node: ts.CallExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression | null {
  if (!ts.isPropertyAccessExpression(node.expression)) return null;

  const callee = node.expression;
  const receiver = callee.expression;
  const method = callee.name.text;

  if (!(STRING_METHODS.has(method) && ts.isPropertyAccessExpression(receiver))) {
    return null;
  }

  const chain = collectPropertyChain(receiver);
  if (chain === null || chain.root !== tctx.paramName) {
    return makeUnsupported(receiver, { sink: tctx.sink, methodName: tctx.methodName });
  }

  const propNode = buildPropertyNode(chain.segments, chain.hasOptional);
  const argExprs = Array.from(node.arguments).map((a) => tctx.recurse(a, depth + 1));

  return makeObject([
    prop('type', str('method')),
    prop('method', str(method)),
    prop('object', propNode),
    prop('args', makeArray(argExprs))
  ]);
}
