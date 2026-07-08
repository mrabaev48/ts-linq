import * as ts from 'typescript';

import { makeObject, num, prop, str } from '../../nodes/builders';
import type { TransformContext } from '../TransformContext';

function makeLiteral(value: ts.Expression): ts.ObjectLiteralExpression {
  return makeObject([prop('type', str('literal')), prop('value', value)]);
}

export function visitNumeric(
  node: ts.NumericLiteral,
  _tctx: TransformContext,
  _depth: number
): ts.Expression {
  return makeLiteral(num(node.text));
}

export function visitString(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  _tctx: TransformContext,
  _depth: number
): ts.Expression {
  return makeLiteral(str(node.text));
}

export function visitTrue(
  _node: ts.Expression,
  _tctx: TransformContext,
  _depth: number
): ts.Expression {
  return makeLiteral(ts.factory.createTrue());
}

export function visitFalse(
  _node: ts.Expression,
  _tctx: TransformContext,
  _depth: number
): ts.Expression {
  return makeLiteral(ts.factory.createFalse());
}

export function visitNull(
  _node: ts.Expression,
  _tctx: TransformContext,
  _depth: number
): ts.Expression {
  return makeLiteral(ts.factory.createNull());
}
