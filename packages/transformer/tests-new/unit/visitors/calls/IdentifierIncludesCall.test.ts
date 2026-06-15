import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as IdentifierIncludesCall from '../../../../src/expression/visitors/calls/IdentifierIncludesCall';
import { makeSink, makeTestContext, parseExpr, printNode } from '../../helpers';

describe('IdentifierIncludesCall (Pattern C)', () => {
  it('roles.includes(u.role) → InNode with valuesRef + captured parameter', () => {
    const tctx = makeTestContext();
    const node = parseExpr('roles.includes(u.role)') as ts.CallExpression;
    const result = IdentifierIncludesCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('"in"');
    expect(text).toContain('valuesRef');
    expect(tctx.parameters).toHaveLength(1);
  });

  it('non-property argument → unsupported sentinel (commits, no fall-through)', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('roles.includes("literal")') as ts.CallExpression;
    const result = IdentifierIncludesCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    expect(printNode(result!)).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });

  it('returns null when receiver is the lambda parameter itself (not my pattern)', () => {
    const tctx = makeTestContext('u');
    const node = parseExpr('u.includes(u.role)') as ts.CallExpression;
    expect(IdentifierIncludesCall.tryVisit(node, tctx, 0)).toBeNull();
  });

  it('returns null for an array-literal receiver (Pattern B territory)', () => {
    const tctx = makeTestContext();
    const node = parseExpr('["a"].includes(u.role)') as ts.CallExpression;
    expect(IdentifierIncludesCall.tryVisit(node, tctx, 0)).toBeNull();
  });
});
