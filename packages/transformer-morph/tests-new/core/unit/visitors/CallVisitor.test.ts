import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as CallVisitor from '../../../../src/core/expression/visitors/CallVisitor';
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

describe('CallVisitor — EF.functions markers → EfFunctionNode', () => {
  it('EF.functions.like(p.title, "%urgent%") → EfFunctionNode', () => {
    const tctx = makeTestContext('p');
    const node = parseExpr('EF.functions.like(p.title, "%urgent%")') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"efFunction"');
    expect(text).toContain('"like"');
    expect(text).toContain('"title"');
    expect(text).toContain('%urgent%');
  });

  it('EF.functions.random() → EfFunctionNode with empty args', () => {
    const tctx = makeTestContext('_');
    const node = parseExpr('EF.functions.random()') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"efFunction"');
    expect(text).toContain('"random"');
  });

  it('EF.functions.dateDiffDay(l.createdAt, now) → EfFunctionNode with parameterRef', () => {
    const tctx = makeTestContext('l');
    const node = parseExpr('EF.functions.dateDiffDay(l.createdAt, now)') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"efFunction"');
    expect(text).toContain('"dateDiffDay"');
    expect(text).toContain('"createdAt"');
    expect(text).toContain('parameterRef');
    expect(tctx.parameters).toHaveLength(1);
  });

  it('EF.functions.greatest(p.a, p.b) → EfFunctionNode with two property args', () => {
    const tctx = makeTestContext('p');
    const node = parseExpr('EF.functions.greatest(p.a, p.b)') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"efFunction"');
    expect(text).toContain('"greatest"');
    expect(text).toContain('"a"');
    expect(text).toContain('"b"');
  });

  it('EF.functions.iLike(p.title, "%test%") → EfFunctionNode', () => {
    const tctx = makeTestContext('p');
    const node = parseExpr('EF.functions.iLike(p.title, "%test%")') as ts.CallExpression;
    const result = CallVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"efFunction"');
    expect(text).toContain('"iLike"');
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
