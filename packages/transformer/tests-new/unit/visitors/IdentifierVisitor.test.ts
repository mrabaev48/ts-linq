import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { TS_LINQ_DIAGNOSTIC_CODE } from '../../../src/diagnostics/DiagnosticSink';
import * as IdentifierVisitor from '../../../src/expression/visitors/IdentifierVisitor';
import { makeSink, makeTestContext, parseExpr, printNode } from '../helpers';

describe('IdentifierVisitor', () => {
  it('bare param identifier → diagnostic + UnsupportedNode', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseExpr('u') as ts.Identifier;
    const result = IdentifierVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
    const msg = calls[0]!.messageText as string;
    expect(msg).toContain('"u"');
    expect(msg).toContain('property access');
  });

  it('external variable → ParameterRefNode with index 0', () => {
    const tctx = makeTestContext('u');
    const node = parseExpr('minAge') as ts.Identifier;
    const result = IdentifierVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"parameterRef"');
    expect(text).toContain('index');
    expect(text).toContain('0');
    expect(tctx.parameters).toHaveLength(1);
  });

  it('external variables → sequential index values', () => {
    const tctx = makeTestContext('u');
    IdentifierVisitor.visit(parseExpr('minAge') as ts.Identifier, tctx, 0);
    IdentifierVisitor.visit(parseExpr('maxAge') as ts.Identifier, tctx, 0);
    expect(tctx.parameters).toHaveLength(2);
    const result1 = printNode(
      IdentifierVisitor.visit(
        parseExpr('minAge') as ts.Identifier,
        { ...tctx, parameters: [ts.factory.createNull()] },
        0
      )
    );
    expect(result1).toContain('1');
  });
});
