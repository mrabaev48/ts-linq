import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import * as LiteralVisitor from '../../../../src/core/expression/visitors/LiteralVisitor';
import { makeTestContext, printNode } from '../helpers';

const tctx = makeTestContext();

function makeLiteralExpr(kind: ts.SyntaxKind): ts.Expression {
  switch (kind) {
    case ts.SyntaxKind.TrueKeyword:
      return ts.factory.createTrue();
    case ts.SyntaxKind.FalseKeyword:
      return ts.factory.createFalse();
    case ts.SyntaxKind.NullKeyword:
      return ts.factory.createNull();
    default:
      throw new Error(`Unexpected kind: ${kind}`);
  }
}

describe('LiteralVisitor', () => {
  it('visitNumeric produces { type: "literal", value: <number> }', () => {
    const node = ts.factory.createNumericLiteral('42');
    const result = LiteralVisitor.visitNumeric(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('42');
  });

  it('visitString produces { type: "literal", value: "hello" }', () => {
    const node = ts.factory.createStringLiteral('hello');
    const result = LiteralVisitor.visitString(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('"hello"');
  });

  it('visitTrue produces { type: "literal", value: true }', () => {
    const result = LiteralVisitor.visitTrue(makeLiteralExpr(ts.SyntaxKind.TrueKeyword), tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('true');
  });

  it('visitFalse produces { type: "literal", value: false }', () => {
    const result = LiteralVisitor.visitFalse(makeLiteralExpr(ts.SyntaxKind.FalseKeyword), tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('false');
  });

  it('visitNull produces { type: "literal", value: null }', () => {
    const result = LiteralVisitor.visitNull(makeLiteralExpr(ts.SyntaxKind.NullKeyword), tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('null');
  });
});
