import * as ts from 'typescript';

import { makeObject, makeUnsupported, num, prop, str } from '../../nodes/builders';
import type { TransformContext } from '../TransformContext';

export function visit(
  node: ts.PrefixUnaryExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  // `!expr` → NotNode
  if (node.operator === ts.SyntaxKind.ExclamationToken) {
    return makeObject([
      prop('type', str('not')),
      prop('operand', tctx.recurse(node.operand, depth + 1))
    ]);
  }

  // `-number` → negative LiteralNode
  if (node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return makeObject([
      prop('type', str('literal')),
      prop(
        'value',
        ts.factory.createPrefixUnaryExpression(
          ts.SyntaxKind.MinusToken,
          ts.factory.createNumericLiteral(node.operand.text)
        )
      )
    ]);
  }

  // `+number` → LiteralNode
  if (node.operator === ts.SyntaxKind.PlusToken && ts.isNumericLiteral(node.operand)) {
    return makeObject([prop('type', str('literal')), prop('value', num(node.operand.text))]);
  }

  return makeUnsupported(node, { sink: tctx.sink, methodName: tctx.methodName });
}
