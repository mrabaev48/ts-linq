import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as CallVisitor from '../../../src/expression/visitors/CallVisitor';
import { makeTestContext, parseExpr, printNode } from '../helpers';

/**
 * AST-output snapshots locking the emitted node shape across the CallVisitor split.
 * One representative case per pattern (A/B/C/D) plus the unsupported fallback, driven
 * through the thin dispatcher exactly as the ExpressionDispatcher does.
 */
describe('CallVisitor — AST output snapshots', () => {
  const cases: ReadonlyArray<[name: string, code: string, paramName: string]> = [
    ['Pattern A — string method', 'u.name.includes("foo")', 'u'],
    ['Pattern B — array includes (IN)', '["admin","mod"].includes(u.role)', 'u'],
    ['Pattern C — identifier includes (IN ref)', 'roles.includes(u.role)', 'u'],
    ['Pattern D — EF.functions', 'EF.functions.like(p.title, "%urgent%")', 'p'],
    [
      'Pattern D — EF.functions with parameterRef',
      'EF.functions.dateDiffDay(l.createdAt, now)',
      'l'
    ],
    ['Fallback — unsupported call', 'Math.floor(u.age)', 'u']
  ];

  for (const [name, code, paramName] of cases) {
    it(`${name}: ${code}`, () => {
      const tctx = makeTestContext(paramName);
      const node = parseExpr(code) as ts.CallExpression;
      const result = CallVisitor.visit(node, tctx, 0);
      expect(printNode(result)).toMatchSnapshot();
    });
  }
});
