import type { MethodNode, PropertyNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { HierarchyIdTranslator } from '@ts-linq/types';

import { ParameterStyle } from '../src/ParameterStyle';
import { SqlVisitor } from '../src/SqlVisitor';
import { HierarchyMethodVisitor, isHierarchyMethod } from '../src/visitors/HierarchyMethodVisitor';
import { makeCtx } from './helpers/makeCtx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prop = (name: string): PropertyNode => ({ type: 'property', name });

const mockTranslator: HierarchyIdTranslator = {
  isDescendantOf: (col, p) => `${col}.IsDescendantOf(hierarchyid::Parse(${p})) = 1`,
  getLevel: (col) => `${col}.GetLevel()`,
  getAncestor: (col, p) => `${col}.GetAncestor(${p})`
};

// ─── isHierarchyMethod ────────────────────────────────────────────────────────

describe('isHierarchyMethod', () => {
  it('returns true for hierarchy methods', () => {
    expect(isHierarchyMethod('isDescendantOf')).toBe(true);
    expect(isHierarchyMethod('getLevel')).toBe(true);
    expect(isHierarchyMethod('getAncestor')).toBe(true);
  });

  it('returns false for non-hierarchy methods', () => {
    expect(isHierarchyMethod('includes')).toBe(false);
    expect(isHierarchyMethod('distance')).toBe(false);
    expect(isHierarchyMethod('unknown')).toBe(false);
  });
});

// ─── HierarchyMethodVisitor ───────────────────────────────────────────────────

describe('HierarchyMethodVisitor', () => {
  let visitor: HierarchyMethodVisitor;

  beforeEach(() => {
    visitor = new HierarchyMethodVisitor(mockTranslator);
  });

  it('translates getLevel (unary, no args)', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'getLevel',
      object: prop('path'),
      args: []
    };
    const result = visitor.visit(node, makeCtx());
    expect(result.condition).toBe('path.GetLevel()');
    expect(result.parameters).toHaveLength(0);
  });

  it('translates isDescendantOf with literal arg', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'isDescendantOf',
      object: prop('path'),
      args: [{ type: 'literal', value: '/1/' as unknown as null }]
    };
    const result = visitor.visit(node, makeCtx());
    expect(result.condition).toBe('path.IsDescendantOf(hierarchyid::Parse(?)) = 1');
    expect(result.parameters).toEqual(['/1/']);
  });

  it('translates isDescendantOf with parameterRef', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'isDescendantOf',
      object: prop('path'),
      args: [{ type: 'parameterRef', index: 0 }]
    };
    const result = visitor.visit(node, makeCtx({ inputParameters: ['/2/'] }));
    expect(result.condition).toBe('path.IsDescendantOf(hierarchyid::Parse(?)) = 1');
    expect(result.parameters).toEqual(['/2/']);
  });

  it('translates getAncestor with literal arg', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'getAncestor',
      object: prop('path'),
      args: [{ type: 'literal', value: 2 as unknown as null }]
    };
    const result = visitor.visit(node, makeCtx());
    expect(result.condition).toBe('path.GetAncestor(?)');
    expect(result.parameters).toEqual([2]);
  });

  it('throws when isDescendantOf has no args', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'isDescendantOf',
      object: prop('path'),
      args: []
    };
    expect(() => visitor.visit(node, makeCtx())).toThrow(AstSqlGenerationError);
  });

  it('throws for unknown hierarchy method', () => {
    const node = {
      type: 'method',
      method: 'getDescendant',
      object: prop('path'),
      args: []
    } as unknown as MethodNode;
    expect(() => visitor.visit(node, makeCtx())).toThrow(AstSqlGenerationError);
  });

  it('uses positional placeholders when state is positional', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'isDescendantOf',
      object: prop('path'),
      args: [{ type: 'literal', value: '/1/' as unknown as null }]
    };
    const visitor2 = new HierarchyMethodVisitor({
      isDescendantOf: (col, p) => `${col} <@ ${p}::ltree`,
      getLevel: (col) => `nlevel(${col})`,
      getAncestor: (col, p) => `subpath(${col}, 0, nlevel(${col}) - ${p})`
    });
    const result = visitor2.visit(node, makeCtx());
    expect(result.condition).toContain('?');
  });
});

// ─── SqlVisitor integration ───────────────────────────────────────────────────

describe('SqlVisitor with hierarchyTranslator', () => {
  it('throws when hierarchyTranslator not provided', () => {
    const visitor = new SqlVisitor(ParameterStyle.Question);
    expect(() =>
      visitor.toSql({
        type: 'method',
        method: 'isDescendantOf',
        object: prop('path'),
        args: [{ type: 'literal', value: '/1/' as unknown as null }]
      })
    ).toThrow('HierarchyIdTranslator');
  });

  it('generates SQL with hierarchyTranslator', () => {
    const visitor = new SqlVisitor(ParameterStyle.Question, {
      hierarchyTranslator: mockTranslator
    });
    const result = visitor.toSql({
      type: 'method',
      method: 'isDescendantOf',
      object: prop('path'),
      args: [{ type: 'literal', value: '/1/' as unknown as null }]
    });
    expect(result.condition).toBe('path.IsDescendantOf(hierarchyid::Parse(?)) = 1');
  });
});
