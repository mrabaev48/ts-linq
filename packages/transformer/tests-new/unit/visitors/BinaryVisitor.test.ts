import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import { TS_LINQ_DIAGNOSTIC_CODE } from '../../../src/diagnostics/DiagnosticSink';
import * as BinaryVisitor from '../../../src/expression/visitors/BinaryVisitor';
import { makeSink, makeTestContext, parseExpr, printNode } from '../helpers';

function parseBinary(code: string): ts.BinaryExpression {
  const node = parseExpr(code);
  if (!ts.isBinaryExpression(node)) throw new Error(`Not a BinaryExpression: ${code}`);
  return node;
}

describe('BinaryVisitor — comparison operators', () => {
  const OPS: Array<[string, string]> = [
    ['u.age > 18', '>'],
    ['u.age < 18', '<'],
    ['u.age >= 18', '>='],
    ['u.age <= 18', '<='],
    ['u.id === 1', '==='],
    ['u.id !== 1', '!=='],
    ['u.id == 1', '=='],
    ['u.id != 1', '!=']
  ];

  for (const [code, op] of OPS) {
    it(`${code} → binary operator "${op}"`, () => {
      const tctx = makeTestContext();
      const node = parseBinary(code);
      const result = BinaryVisitor.visit(node, tctx, 0);
      const text = printNode(result);
      expect(text).toContain('"binary"');
      expect(text).toContain(`"${op}"`);
    });
  }
});

describe('BinaryVisitor — logical operators', () => {
  it('&& → logical node with operator "&&"', () => {
    const tctx = makeTestContext();
    const node = parseBinary('u.age > 18 && u.active === true');
    const result = BinaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"logical"');
    expect(text).toContain('"&&"');
  });

  it('|| → logical node with operator "||"', () => {
    const tctx = makeTestContext();
    const node = parseBinary('u.age > 18 || u.vip === true');
    const result = BinaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"logical"');
    expect(text).toContain('"||"');
  });
});

describe('BinaryVisitor — null checks', () => {
  it('u.deletedAt === null → isNull node', () => {
    const tctx = makeTestContext();
    const node = parseBinary('u.deletedAt === null');
    const result = BinaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"isNull"');
  });

  it('u.deletedAt !== null → isNotNull node', () => {
    const tctx = makeTestContext();
    const node = parseBinary('u.deletedAt !== null');
    const result = BinaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"isNotNull"');
  });

  it('null === u.name → isNull (null on left side)', () => {
    const tctx = makeTestContext();
    const node = parseBinary('null === u.name');
    const result = BinaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"isNull"');
  });
});

describe('BinaryVisitor — unsupported operator', () => {
  it('+ operator emits diagnostic with code 90001 and returns UnsupportedNode', () => {
    const { sink, calls } = makeSink();
    const tctx = makeTestContext('u', 'where', sink);
    const node = parseBinary('u.id + 1');
    const result = BinaryVisitor.visit(node, tctx, 0);
    const text = printNode(result);
    expect(text).toContain('"unsupported"');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.code).toBe(TS_LINQ_DIAGNOSTIC_CODE);
  });
});
