import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { dispatch } from '../../../src/core/expression/ExpressionDispatcher';
import { MAX_DEPTH, transformExpression } from '../../../src/core/expression/transformExpression';
import { makeSink, makeTestContext, printNode } from './helpers';

describe('ExpressionDispatcher', () => {
  it('known SyntaxKind (NumericLiteral) → dispatches to LiteralVisitor', () => {
    const tctx = makeTestContext();
    const node = ts.factory.createNumericLiteral('99');
    const result = dispatch(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"literal"');
    expect(text).toContain('99');
  });

  it('unknown SyntaxKind → UnsupportedNode + diagnostic', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    // A ternary expression is not in the dispatch map
    const sf = ts.createSourceFile('test.ts', 'true ? 1 : 2;', ts.ScriptTarget.ES2020, true);
    const stmt = sf.statements[0] as ts.ExpressionStatement;
    const node = stmt.expression as ts.Expression;
    const result = dispatch(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
  });
});

describe('transformExpression — depth guard', () => {
  it(`depth > MAX_DEPTH (${MAX_DEPTH}) → UnsupportedNode`, () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    // Use a real parsed node (not synthetic) so it has a source position
    const sf = ts.createSourceFile('test.ts', '1;', ts.ScriptTarget.ES2020, true);
    const stmt = sf.statements[0] as ts.ExpressionStatement;
    const node = stmt.expression;
    const result = transformExpression(node, tctx, MAX_DEPTH + 1);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    // makeUnsupported is called with tctx.sink, so diagnostic IS emitted
    expect(calls).toHaveLength(1);
  });
});
