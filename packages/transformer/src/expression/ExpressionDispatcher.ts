import * as ts from 'typescript';

import { makeUnsupported } from '../nodes/builders';
import type { TransformContext } from './TransformContext';
import * as BinaryVisitor from './visitors/BinaryVisitor';
import * as CallVisitor from './visitors/CallVisitor';
import * as IdentifierVisitor from './visitors/IdentifierVisitor';
import * as LiteralVisitor from './visitors/LiteralVisitor';
import * as PrefixUnaryVisitor from './visitors/PrefixUnaryVisitor';
import * as PropertyAccessVisitor from './visitors/PropertyAccessVisitor';

type VisitorFn = (node: ts.Expression, tctx: TransformContext, depth: number) => ts.Expression;

const DISPATCH_MAP: Partial<Record<ts.SyntaxKind, VisitorFn>> = {
  [ts.SyntaxKind.PrefixUnaryExpression]: PrefixUnaryVisitor.visit as VisitorFn,
  [ts.SyntaxKind.CallExpression]: CallVisitor.visit as VisitorFn,
  [ts.SyntaxKind.BinaryExpression]: BinaryVisitor.visit as VisitorFn,
  [ts.SyntaxKind.PropertyAccessExpression]: PropertyAccessVisitor.visit as VisitorFn,
  [ts.SyntaxKind.Identifier]: IdentifierVisitor.visit as VisitorFn,
  [ts.SyntaxKind.NumericLiteral]: LiteralVisitor.visitNumeric as VisitorFn,
  [ts.SyntaxKind.StringLiteral]: LiteralVisitor.visitString as VisitorFn,
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: LiteralVisitor.visitString as VisitorFn,
  [ts.SyntaxKind.TrueKeyword]: LiteralVisitor.visitTrue,
  [ts.SyntaxKind.FalseKeyword]: LiteralVisitor.visitFalse,
  [ts.SyntaxKind.NullKeyword]: LiteralVisitor.visitNull
};

export function dispatch(
  node: ts.Expression,
  tctx: TransformContext,
  depth: number
): ts.Expression {
  const handler = DISPATCH_MAP[node.kind];
  return handler !== undefined ? handler(node, tctx, depth) : makeUnsupported(node, tctx.sink);
}
