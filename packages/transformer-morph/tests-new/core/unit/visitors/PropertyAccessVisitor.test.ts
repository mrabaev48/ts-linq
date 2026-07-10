import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as PropertyAccessVisitor from '../../../../src/core/expression/visitors/PropertyAccessVisitor';
import { makeSink, makeTestContext, parseExpr, printNode } from '../helpers';

describe('PropertyAccessVisitor', () => {
  it('u.age → PropertyNode with name "age"', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.age') as ts.PropertyAccessExpression;
    const result = PropertyAccessVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"property"');
    expect(text).toContain('"age"');
    expect(text).not.toContain('path');
  });

  it('u.profile.age → PropertyNode with path ["profile", "age"]', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.profile.age') as ts.PropertyAccessExpression;
    const result = PropertyAccessVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"property"');
    expect(text).toContain('path');
    expect(text).toContain('"profile"');
    expect(text).toContain('"age"');
  });

  it('external dotted ref → ParameterRefNode + captured in parameters', () => {
    const tctx = makeTestContext();
    const node = parseExpr('config.maxAge') as ts.PropertyAccessExpression;
    const result = PropertyAccessVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"parameterRef"');
    expect(text).toContain('index');
    expect(tctx.parameters).toHaveLength(1);
  });

  it('unsupported chain (call as root) → UnsupportedNode + diagnostic', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('foo().bar') as ts.PropertyAccessExpression;
    const result = PropertyAccessVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });
});
