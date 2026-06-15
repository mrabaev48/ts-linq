import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as EfFunctionCall from '../../../../src/expression/visitors/calls/EfFunctionCall';
import { makeTestContext, parseExpr, printNode } from '../../helpers';

describe('EfFunctionCall (Pattern D)', () => {
  it('EF.functions.like(p.title, "%urgent%") → EfFunctionNode', () => {
    const tctx = makeTestContext('p');
    const node = parseExpr('EF.functions.like(p.title, "%urgent%")') as ts.CallExpression;
    const result = EfFunctionCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('"efFunction"');
    expect(text).toContain('"like"');
    expect(text).toContain('"title"');
    expect(text).toContain('%urgent%');
  });

  it('EF.functions.random() → EfFunctionNode with empty args', () => {
    const tctx = makeTestContext('_');
    const node = parseExpr('EF.functions.random()') as ts.CallExpression;
    const result = EfFunctionCall.tryVisit(node, tctx, 0);
    expect(printNode(result!)).toContain('"random"');
  });

  it('EF.functions.dateDiffDay(l.createdAt, now) → property + parameterRef', () => {
    const tctx = makeTestContext('l');
    const node = parseExpr('EF.functions.dateDiffDay(l.createdAt, now)') as ts.CallExpression;
    const result = EfFunctionCall.tryVisit(node, tctx, 0);
    const text = printNode(result!);
    expect(text).toContain('"createdAt"');
    expect(text).toContain('parameterRef');
    expect(tctx.parameters).toHaveLength(1);
  });

  // Negative numeric literal: now routed through the shared literalToAstNode, so it
  // becomes an inline literal instead of a captured parameterRef (intentional fix —
  // see the array path which always supported it).
  it('EF.functions.dateDiffDay(l.createdAt, -5) → inline literal, no parameter captured', () => {
    const tctx = makeTestContext('l');
    const node = parseExpr('EF.functions.dateDiffDay(l.createdAt, -5)') as ts.CallExpression;
    const result = EfFunctionCall.tryVisit(node, tctx, 0);
    const text = printNode(result!);
    expect(text).toContain('"literal"');
    expect(text).toContain('-5');
    expect(text).not.toContain('parameterRef');
    expect(tctx.parameters).toHaveLength(0);
  });

  it('EF.functions.greatest(p.a, p.b) → two property args', () => {
    const tctx = makeTestContext('p');
    const node = parseExpr('EF.functions.greatest(p.a, p.b)') as ts.CallExpression;
    const text = printNode(EfFunctionCall.tryVisit(node, tctx, 0)!);
    expect(text).toContain('"a"');
    expect(text).toContain('"b"');
  });

  it('returns null for a non-EF call (not my pattern)', () => {
    const tctx = makeTestContext('u');
    const node = parseExpr('Math.floor(u.age)') as ts.CallExpression;
    expect(EfFunctionCall.tryVisit(node, tctx, 0)).toBeNull();
  });
});
