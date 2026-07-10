import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as ArrayIncludesCall from '../../../../../src/core/expression/visitors/calls/ArrayIncludesCall';
import { makeSink, makeTestContext, parseExpr, printNode } from '../../helpers';

describe('ArrayIncludesCall (Pattern B)', () => {
  it('["admin","mod"].includes(u.role) → InNode with inline literal values', () => {
    const tctx = makeTestContext();
    const node = parseExpr('["admin","mod"].includes(u.role)') as ts.CallExpression;
    const result = ArrayIncludesCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('"in"');
    expect(text).toContain('"admin"');
    expect(text).toContain('"mod"');
    expect(text).toContain('values');
    expect(text).not.toContain('valuesRef');
  });

  it('[-5, -10].includes(u.age) → InNode with negative literal values (no parameters captured)', () => {
    const tctx = makeTestContext();
    const node = parseExpr('[-5, -10].includes(u.age)') as ts.CallExpression;
    const result = ArrayIncludesCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    const text = printNode(result!);
    expect(text).toContain('"in"');
    expect(text).toContain('-5');
    expect(text).toContain('-10');
    expect(text).not.toContain('unsupported');
    expect(tctx.parameters).toHaveLength(0);
  });

  it('non-property argument → unsupported sentinel (commits, no fall-through)', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('["a"].includes("literal")') as ts.CallExpression;
    const result = ArrayIncludesCall.tryVisit(node, tctx, 0);
    expect(result).not.toBeNull();
    expect(printNode(result!)).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });

  it('returns null for a non-array receiver (not my pattern)', () => {
    const tctx = makeTestContext();
    const node = parseExpr('u.name.includes("foo")') as ts.CallExpression;
    expect(ArrayIncludesCall.tryVisit(node, tctx, 0)).toBeNull();
  });
});
