import { describe, expect, it } from '@jest/globals';
import * as ts from 'typescript';

import {
  buildPropertyNode,
  collectPropertyChain,
  MAX_CHAIN_DEPTH
} from '../../../src/core/nodes/PropertyChain';
import { printNode } from './helpers';

function parsePropAccess(code: string): ts.PropertyAccessExpression {
  const sf = ts.createSourceFile('test.ts', code + ';', ts.ScriptTarget.ES2020, true);
  const stmt = sf.statements[0] as ts.ExpressionStatement;
  const expr = stmt.expression;
  if (!ts.isPropertyAccessExpression(expr))
    throw new Error(`Not a PropertyAccessExpression: ${code}`);
  return expr;
}

describe('collectPropertyChain', () => {
  it('single segment — root + one segment', () => {
    const node = parsePropAccess('u.age');
    const chain = collectPropertyChain(node);
    expect(chain).not.toBeNull();
    expect(chain!.root).toBe('u');
    expect(chain!.segments).toEqual(['age']);
    expect(chain!.hasOptional).toBe(false);
  });

  it('multi segment — root + multiple segments', () => {
    const node = parsePropAccess('u.profile.address.city');
    const chain = collectPropertyChain(node);
    expect(chain).not.toBeNull();
    expect(chain!.root).toBe('u');
    expect(chain!.segments).toEqual(['profile', 'address', 'city']);
  });

  it('optional chaining sets hasOptional = true', () => {
    const sf = ts.createSourceFile('test.ts', 'u?.age;', ts.ScriptTarget.ES2020, true);
    const stmt = sf.statements[0] as ts.ExpressionStatement;
    const node = stmt.expression as ts.PropertyAccessExpression;
    const chain = collectPropertyChain(node);
    expect(chain).not.toBeNull();
    expect(chain!.hasOptional).toBe(true);
  });

  it('returns null when root is not an identifier', () => {
    const sf = ts.createSourceFile('test.ts', 'foo().bar;', ts.ScriptTarget.ES2020, true);
    const stmt = sf.statements[0] as ts.ExpressionStatement;
    const node = stmt.expression as ts.PropertyAccessExpression;
    expect(collectPropertyChain(node)).toBeNull();
  });

  it(`returns null when chain depth exceeds MAX_CHAIN_DEPTH (${MAX_CHAIN_DEPTH})`, () => {
    // Build a deeply nested access: a.b.c...
    const deep = 'a.' + Array.from({ length: MAX_CHAIN_DEPTH + 2 }, (_, i) => `p${i}`).join('.');
    const sf = ts.createSourceFile('test.ts', deep + ';', ts.ScriptTarget.ES2020, true);
    const stmt = sf.statements[0] as ts.ExpressionStatement;
    const node = stmt.expression as ts.PropertyAccessExpression;
    expect(collectPropertyChain(node)).toBeNull();
  });
});

describe('buildPropertyNode', () => {
  it('single segment → { type: "property", name: "age" }', () => {
    const node = buildPropertyNode(['age']);
    const text = printNode(node);
    expect(text).toContain('"property"');
    expect(text).toContain('"age"');
    expect(text).not.toContain('path');
  });

  it('multi segment → { type: "property", path: [...] }', () => {
    const node = buildPropertyNode(['profile', 'address']);
    const text = printNode(node);
    expect(text).toContain('"property"');
    expect(text).toContain('"profile"');
    expect(text).toContain('"address"');
    expect(text).toContain('path');
  });

  it('optional flag → includes optional: true', () => {
    const node = buildPropertyNode(['age'], true);
    const text = printNode(node);
    expect(text).toContain('optional');
    expect(text).toContain('true');
  });

  it('no optional flag → does not include optional', () => {
    const node = buildPropertyNode(['age'], false);
    const text = printNode(node);
    expect(text).not.toContain('optional');
  });
});
