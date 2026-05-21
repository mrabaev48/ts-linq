import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as CallVisitor from '../../../src/expression/visitors/CallVisitor';
import { makeSink, makeTestContext, parseExpr, printNode } from '../helpers';

describe('CallVisitor — array.includes → InNode with inline values', () => {
  it('["admin","mod"].includes(u.role) → InNode with literal values', () => {
    const tctx = makeTestContext();
    const node = parseExpr('["admin","mod"].includes(u.role)') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"in"');
    expect(text).toContain('"admin"');
    expect(text).toContain('"mod"');
    expect(text).not.toContain('valuesRef');
    expect(text).toContain('values');
  });
});

describe('CallVisitor — identifier.includes → InNode with valuesRef', () => {
  it('roles.includes(u.role) → InNode with valuesRef index', () => {
    const tctx = makeTestContext();
    const node = parseExpr('roles.includes(u.role)') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"in"');
    expect(text).toContain('valuesRef');
    expect(tctx.parameters).toHaveLength(1);
  });
});

describe('CallVisitor — string methods → MethodNode', () => {
  it('u.name.includes("foo") → MethodNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.name.includes("foo")') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"method"');
    expect(text).toContain('"includes"');
    expect(text).toContain('"name"');
  });

  it('u.email.startsWith("admin") → MethodNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.email.startsWith("admin")') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"method"');
    expect(text).toContain('"startsWith"');
  });

  it('u.code.endsWith(".ts") → MethodNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.code.endsWith(".ts")') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"method"');
    expect(text).toContain('"endsWith"');
  });
});

describe('CallVisitor — unsupported call', () => {
  it('unknown function call → UnsupportedNode + diagnostic', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('Math.floor(u.age)') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });
});
