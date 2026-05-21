import type * as ts from 'typescript';

import { makeObject, makeUnsupported, num, prop, str } from '../../nodes/builders';
import { buildPropertyNode, collectPropertyChain } from '../../nodes/PropertyChain';
import type { TransformContext } from '../TransformContext';

export function visit(
  node: ts.PropertyAccessExpression,
  tctx: TransformContext,
  _depth: number
): ts.Expression {
  const chain = collectPropertyChain(node);
  if (chain === null) return makeUnsupported(node, tctx.sink);

  const { root, segments, hasOptional } = chain;

  if (root !== tctx.paramName) {
    // External dotted reference (e.g. config.maxAge) — capture as ParameterRef
    const idx = tctx.parameters.length;
    tctx.parameters.push(node);
    return makeObject([prop('type', str('parameterRef')), prop('index', num(idx))]);
  }

  return buildPropertyNode(segments, hasOptional);
}
