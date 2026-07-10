import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as StringMethodCall from '../../../../../src/core/expression/visitors/calls/StringMethodCall';
import { makeSink, makeTestContext, parseExpr, printNode } from '../../helpers';

describe('StringMethodCall (Pattern A)', () => {
  it('u.name.includes("foo") → MethodNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.name.includes("foo")') as ts.CallExpression;
    const result = StringMethodCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('"method"');
    expect(text).toContain('"includes"');
    expect(text).toContain('"name"');
  });

  it('u.email.startsWith("admin") → MethodNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.email.startsWith("admin")') as ts.CallExpression;
    const result = StringMethodCall.tryVisit(node, tctx, 0);
    expect(printNode(result!)).toContain('"startsWith"');
  });

  it('u.code.endsWith(".ts") → MethodNode', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.code.endsWith(".ts")') as ts.CallExpression;
    const result = StringMethodCall.tryVisit(node, tctx, 0);
    expect(printNode(result!)).toContain('"endsWith"');
  });

  it('receiver chain not rooted at lambda param → unsupported sentinel', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('other.name.includes("foo")') as ts.CallExpression;
    const result = StringMethodCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    expect(printNode(result!)).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });

  it('returns null for a non-string method (not my pattern)', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.tags.map(t)') as ts.CallExpression;
    expect(StringMethodCall.tryVisit(node, tctx, 0)).toBeNull();
  });
});
