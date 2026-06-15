import { describe, expect, it } from '@jest/globals';
import type * as ts from 'typescript';

import * as ArrayIncludesCall from '../../../../src/expression/visitors/calls/ArrayIncludesCall';
import * as EfFunctionCall from '../../../../src/expression/visitors/calls/EfFunctionCall';
import { literalToAstNode } from '../../../../src/expression/visitors/calls/shared';
import { makeTestContext, parseExpr, printNode } from '../../helpers';

/** Collapse all runs of whitespace so structural comparisons ignore indentation. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

describe('literalToAstNode — supported literal forms', () => {
  const cases: ReadonlyArray<[label: string, code: string, expected: string]> = [
    ['string', '"abc"', '"abc"'],
    ['number', '42', '42'],
    ['true', 'true', 'true'],
    ['false', 'false', 'false'],
    ['null', 'null', 'null'],
    ['negative number', '-5', '-5']
  ];

  for (const [label, code, expected] of cases) {
    it(`converts ${label}`, () => {
      const arr = parseExpr(`[${code}]`) as ts.ArrayLiteralExpression;
      const node = literalToAstNode(arr.elements[0]!);
      expect(node).not.toBeNull();
      expect(printNode(node!)).toBe(expected);
    });
  }

  it('returns null for a non-literal (runtime value)', () => {
    const arr = parseExpr('[someVar]') as ts.ArrayLiteralExpression;
    expect(literalToAstNode(arr.elements[0]!)).toBeNull();
  });

  it('returns null for a positive unary (only minus is a literal)', () => {
    const arr = parseExpr('[+5]') as ts.ArrayLiteralExpression;
    expect(literalToAstNode(arr.elements[0]!)).toBeNull();
  });
});

describe('literalToAstNode — array and EF paths embed identical literal objects', () => {
  const values = ['"abc"', '42', 'true', 'false', 'null', '-5'];

  for (const v of values) {
    it(`produces the same { type: "literal", value } object for ${v}`, () => {
      const arrayTctx = makeTestContext('u');
      const arrayNode = parseExpr(`[${v}].includes(u.id)`) as ts.CallExpression;
      const arrayText = normalize(printNode(ArrayIncludesCall.tryVisit(arrayNode, arrayTctx, 0)!));

      const efTctx = makeTestContext('u');
      const efNode = parseExpr(`EF.functions.greatest(${v})`) as ts.CallExpression;
      const efText = normalize(printNode(EfFunctionCall.tryVisit(efNode, efTctx, 0)!));

      const literalObject = normalize(`{ type: "literal", value: ${v} }`);
      expect(arrayText).toContain(literalObject);
      expect(efText).toContain(literalObject);
      // Neither path captured a runtime parameter for a pure literal argument.
      expect(arrayTctx.parameters).toHaveLength(0);
      expect(efTctx.parameters).toHaveLength(0);
    });
  }
});
