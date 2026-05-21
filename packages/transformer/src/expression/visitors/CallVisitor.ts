import * as ts from 'typescript';

import { makeArray, makeObject, makeUnsupported, num, prop, str } from '../../nodes/builders';
import { buildPropertyNode, collectPropertyChain } from '../../nodes/PropertyChain';
import type { TransformContext } from '../TransformContext';

const STRING_METHODS = new Set(['includes', 'startsWith', 'endsWith']);

export function visit(
  node: ts.CallExpression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return makeUnsupported(node, tctx.sink);
  }

  const callee = node.expression;
  const receiver = callee.expression;
  const method = callee.name.text;
  const arg0 = node.arguments[0] as ts.Expression | undefined;

  // Pattern B: ["a","b"].includes(u.role)
  if (method === 'includes' && ts.isArrayLiteralExpression(receiver) && arg0 !== undefined) {
    return visitArrayIncludes(receiver, arg0, tctx);
  }

  // Pattern C: roles.includes(u.role)
  if (
    method === 'includes' &&
    ts.isIdentifier(receiver) &&
    receiver.text !== tctx.paramName &&
    arg0 !== undefined
  ) {
    return visitIdentifierIncludes(receiver, arg0, tctx);
  }

  // Pattern A: u.name.includes / startsWith / endsWith
  if (STRING_METHODS.has(method) && ts.isPropertyAccessExpression(receiver)) {
    return visitStringMethod(method, receiver, node.arguments, tctx, depth);
  }

  return makeUnsupported(node, tctx.sink);
}

function visitArrayIncludes(
  arrayNode: ts.ArrayLiteralExpression,
  argNode: ts.Expression,
  tctx: TransformContext
): ts.Expression {
  const propExpr = extractPropertyNode(argNode, tctx.paramName);
  if (propExpr === null) return makeUnsupported(argNode, tctx.sink);

  const valueLiterals: ts.Expression[] = [];
  for (const el of arrayNode.elements) {
    valueLiterals.push(extractArrayElementLiteral(el, tctx));
  }

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

function visitIdentifierIncludes(
  identNode: ts.Identifier,
  argNode: ts.Expression,
  tctx: TransformContext
): ts.Expression {
  const propExpr = extractPropertyNode(argNode, tctx.paramName);
  if (propExpr === null) return makeUnsupported(argNode, tctx.sink);

  const idx = tctx.parameters.length;
  tctx.parameters.push(identNode);

  return makeObject([
    prop('type', str('in')),
    prop('property', propExpr),
    prop('valuesRef', num(idx))
  ]);
}

function visitStringMethod(
  method: string,
  receiverAccess: ts.PropertyAccessExpression,
  args: ts.NodeArray<ts.Expression>,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const chain = collectPropertyChain(receiverAccess);
  if (chain === null || chain.root !== tctx.paramName) {
    return makeUnsupported(receiverAccess, tctx.sink);
  }

  const propNode = buildPropertyNode(chain.segments, chain.hasOptional);
  const argExprs = Array.from(args).map((a) => tctx.recurse(a, depth + 1));

  return makeObject([
    prop('type', str('method')),
    prop('method', str(method)),
    prop('object', propNode),
    prop('args', makeArray(argExprs))
  ]);
}

function extractArrayElementLiteral(el: ts.Expression, tctx: TransformContext): ts.Expression {
  if (ts.isStringLiteral(el)) return str(el.text);
  if (ts.isNumericLiteral(el)) return num(el.text);
  if (el.kind === ts.SyntaxKind.TrueKeyword) return ts.factory.createTrue();
  if (el.kind === ts.SyntaxKind.FalseKeyword) return ts.factory.createFalse();
  if (el.kind === ts.SyntaxKind.NullKeyword) return ts.factory.createNull();
  if (
    ts.isPrefixUnaryExpression(el) &&
    el.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(el.operand)
  ) {
    return ts.factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      ts.factory.createNumericLiteral(el.operand.text)
    );
  }
  return makeUnsupported(el, tctx.sink);
}

function extractPropertyNode(
  argNode: ts.Expression,
  paramName: string
): ts.ObjectLiteralExpression | null {
  if (!ts.isPropertyAccessExpression(argNode)) return null;
  const chain = collectPropertyChain(argNode);
  if (chain === null || chain.root !== paramName) return null;
  return buildPropertyNode(chain.segments, chain.hasOptional);
}
