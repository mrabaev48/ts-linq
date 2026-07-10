import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as PrefixUnaryVisitor from '../../../../src/core/expression/visitors/PrefixUnaryVisitor';
import { makeSink, makeTestContext, parseExpr, printNode } from '../helpers';

describe('PrefixUnaryVisitor', () => {
  it('!expr → NotNode', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('!u.active') as ts.PrefixUnaryExpression;
    const result = PrefixUnaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"not"');
    expect(text).toContain('operand');
    expect(calls).toHaveLength(0);
  });

  it('-42 → negative LiteralNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('-42') as ts.PrefixUnaryExpression;
    const result = PrefixUnaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('-42');
  });

  it('+42 → positive LiteralNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('+42') as ts.PrefixUnaryExpression;
    const result = PrefixUnaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('42');
  });

  it('unsupported unary (~x) → UnsupportedNode + diagnostic', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('~42') as ts.PrefixUnaryExpression;
    const result = PrefixUnaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });
});
