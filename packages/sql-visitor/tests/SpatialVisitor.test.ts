import type { MethodNode, PropertyNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';
import type { SpatialTranslator } from '@ts-linq/types';

import { ParameterStyle } from '../src/ParameterStyle';
import { SqlVisitor } from '../src/SqlVisitor';
import { isSpatialMethod, SpatialMethodVisitor } from '../src/visitors/SpatialMethodVisitor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const prop = (name: string): PropertyNode => ({ type: 'property', name });

const mockTranslator: SpatialTranslator = {
  distance: (col, p) => `ST_Distance(${col}, ${p})`,
  intersects: (col, p) => `ST_Intersects(${col}, ${p})`,
  within: (col, p) => `ST_Within(${col}, ${p})`,
  buffer: (col, p) => `ST_Buffer(${col}, ${p})`,
  area: (col) => `ST_Area(${col})`,
  length: (col) => `ST_Length(${col})`,
  contains: (col, p) => `ST_Contains(${col}, ${p})`
};

// ─── isSpatialMethod ──────────────────────────────────────────────────────────

describe('isSpatialMethod', () => {
  it('returns true for all spatial methods', () => {
    expect(isSpatialMethod('distance')).toBe(true);
    expect(isSpatialMethod('intersects')).toBe(true);
    expect(isSpatialMethod('within')).toBe(true);
    expect(isSpatialMethod('buffer')).toBe(true);
    expect(isSpatialMethod('area')).toBe(true);
    expect(isSpatialMethod('length')).toBe(true);
    expect(isSpatialMethod('contains')).toBe(true);
  });

  it('returns false for string methods', () => {
    expect(isSpatialMethod('includes')).toBe(false);
    expect(isSpatialMethod('startsWith')).toBe(false);
    expect(isSpatialMethod('endsWith')).toBe(false);
    expect(isSpatialMethod('unknown')).toBe(false);
  });
});

// ─── SpatialMethodVisitor ─────────────────────────────────────────────────────

describe('SpatialMethodVisitor', () => {
  let visitor: SpatialMethodVisitor;

  beforeEach(() => {
    visitor = new SpatialMethodVisitor(mockTranslator);
  });

  it('translates distance with literal arg', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'distance',
      object: prop('location'),
      args: [{ type: 'literal', value: 'POINT(0 0)' as unknown as null }]
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('ST_Distance(location, ?)');
    expect(result.parameters).toEqual(['POINT(0 0)']);
  });

  it('translates intersects with parameter ref', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'intersects',
      object: prop('geom'),
      args: [{ type: 'parameterRef', index: 0 }]
    };
    const result = visitor.visit(node, ['POLYGON(...)']);
    expect(result.condition).toBe('ST_Intersects(geom, ?)');
    expect(result.parameters).toEqual(['POLYGON(...)']);
  });

  it('translates within', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'within',
      object: prop('location'),
      args: [{ type: 'literal', value: null }]
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('ST_Within(location, ?)');
  });

  it('translates buffer', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'buffer',
      object: prop('location'),
      args: [{ type: 'literal', value: 1000 }]
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('ST_Buffer(location, ?)');
    expect(result.parameters).toEqual([1000]);
  });

  it('translates area (unary — no parameters)', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'area',
      object: prop('geom'),
      args: []
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('ST_Area(geom)');
    expect(result.parameters).toHaveLength(0);
  });

  it('translates length (unary — no parameters)', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'length',
      object: prop('path'),
      args: []
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('ST_Length(path)');
    expect(result.parameters).toHaveLength(0);
  });

  it('translates contains', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'contains',
      object: prop('zone'),
      args: [{ type: 'literal', value: null }]
    };
    const result = visitor.visit(node, []);
    expect(result.condition).toBe('ST_Contains(zone, ?)');
  });

  it('throws when binary spatial method has no argument', () => {
    const node: MethodNode = {
      type: 'method',
      method: 'distance',
      object: prop('location'),
      args: []
    };
    expect(() => visitor.visit(node, [])).toThrow(AstSqlGenerationError);
  });
});

// ─── SqlVisitor integration with spatial translator ────────────────────────────

describe('SqlVisitor with spatialTranslator', () => {
  it('routes distance method node to translator', () => {
    const sqlVisitor = new SqlVisitor(ParameterStyle.Question, {
      spatialTranslator: mockTranslator
    });
    const node: MethodNode = {
      type: 'method',
      method: 'distance',
      object: prop('location'),
      args: [{ type: 'literal', value: null }]
    };
    const result = sqlVisitor.toSql(node, []);
    expect(result.condition).toBe('ST_Distance(location, ?)');
  });

  it('throws when spatial method used without translator', () => {
    const sqlVisitor = new SqlVisitor();
    const node: MethodNode = {
      type: 'method',
      method: 'distance',
      object: prop('location'),
      args: [{ type: 'literal', value: null }]
    };
    expect(() => sqlVisitor.toSql(node, [])).toThrow(AstSqlGenerationError);
  });
});
