import type { JsonPathExpression } from '../src/ast/JsonPathExpression';
import type {
  BinaryNode,
  ExpressionNode,
  InNode,
  IsNotNullNode,
  IsNullNode,
  JsonPathNode,
  LiteralNode,
  LogicalNode,
  MethodNode,
  NotNode,
  ParameterRefNode,
  PropertyNode,
  UnsupportedNode
} from '../src/ast/Nodes';

describe('AST Nodes', () => {
  describe('PropertyNode', () => {
    it('single-segment name', () => {
      const node: PropertyNode = { type: 'property', name: 'userId' };
      expect(node.type).toBe('property');
      expect(node.name).toBe('userId');
    });

    it('multi-segment path', () => {
      const node: PropertyNode = { type: 'property', path: ['profile', 'age'] };
      expect(node.path).toEqual(['profile', 'age']);
    });

    it('optional flag', () => {
      const node: PropertyNode = { type: 'property', name: 'age', optional: true };
      expect(node.optional).toBe(true);
    });

    it('assignable to ExpressionNode', () => {
      const node: PropertyNode = { type: 'property', name: 'x' };
      const expr: ExpressionNode = node;
      expect(expr.type).toBe('property');
    });
  });

  describe('LiteralNode', () => {
    it('string literal', () => {
      const node: LiteralNode = { type: 'literal', value: 'hello' };
      expect(node.type).toBe('literal');
      expect(node.value).toBe('hello');
    });

    it('number literal', () => {
      const node: LiteralNode = { type: 'literal', value: 42 };
      expect(node.value).toBe(42);
    });

    it('boolean literals', () => {
      expect(({ type: 'literal', value: true } as LiteralNode).value).toBe(true);
      expect(({ type: 'literal', value: false } as LiteralNode).value).toBe(false);
    });

    it('null literal', () => {
      const node: LiteralNode = { type: 'literal', value: null };
      expect(node.value).toBeNull();
    });
  });

  describe('ParameterRefNode', () => {
    it('references runtime parameter by index', () => {
      const node: ParameterRefNode = { type: 'parameterRef', index: 0 };
      expect(node.type).toBe('parameterRef');
      expect(node.index).toBe(0);
    });
  });

  describe('BinaryNode', () => {
    it('equality comparison (===)', () => {
      const node: BinaryNode = {
        type: 'binary',
        operator: '===',
        left: { type: 'property', name: 'age' },
        right: { type: 'literal', value: 18 }
      };
      expect(node.type).toBe('binary');
      expect(node.operator).toBe('===');
      expect(node.left.type).toBe('property');
      expect(node.right.type).toBe('literal');
    });

    it('supports all comparison operators', () => {
      const ops: BinaryNode['operator'][] = ['==', '===', '!=', '!==', '>', '<', '>=', '<='];
      for (const op of ops) {
        const node: BinaryNode = {
          type: 'binary',
          operator: op,
          left: { type: 'property', name: 'x' },
          right: { type: 'literal', value: 0 }
        };
        expect(node.operator).toBe(op);
      }
    });
  });

  describe('LogicalNode', () => {
    it('AND expression', () => {
      const node: LogicalNode = {
        type: 'logical',
        operator: '&&',
        left: {
          type: 'binary',
          operator: '>',
          left: { type: 'property', name: 'age' },
          right: { type: 'literal', value: 18 }
        },
        right: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'active' },
          right: { type: 'literal', value: true }
        }
      };
      expect(node.type).toBe('logical');
      expect(node.operator).toBe('&&');
    });

    it('OR expression', () => {
      const node: LogicalNode = {
        type: 'logical',
        operator: '||',
        left: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'role' },
          right: { type: 'literal', value: 'admin' }
        },
        right: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'role' },
          right: { type: 'literal', value: 'mod' }
        }
      };
      expect(node.operator).toBe('||');
    });

    it('nested logical expressions', () => {
      const inner: LogicalNode = {
        type: 'logical',
        operator: '||',
        left: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'role' },
          right: { type: 'literal', value: 'admin' }
        },
        right: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'role' },
          right: { type: 'literal', value: 'owner' }
        }
      };
      const outer: LogicalNode = {
        type: 'logical',
        operator: '&&',
        left: {
          type: 'binary',
          operator: '===',
          left: { type: 'property', name: 'active' },
          right: { type: 'literal', value: true }
        },
        right: inner
      };
      expect(outer.right.type).toBe('logical');
    });
  });

  describe('NotNode', () => {
    it('negation over property', () => {
      const node: NotNode = { type: 'not', operand: { type: 'property', name: 'isActive' } };
      expect(node.type).toBe('not');
      expect(node.operand.type).toBe('property');
    });
  });

  describe('IsNullNode / IsNotNullNode', () => {
    it('IS NULL', () => {
      const node: IsNullNode = {
        type: 'isNull',
        property: { type: 'property', name: 'deletedAt' }
      };
      expect(node.type).toBe('isNull');
    });

    it('IS NOT NULL', () => {
      const node: IsNotNullNode = {
        type: 'isNotNull',
        property: { type: 'property', name: 'publishedAt' }
      };
      expect(node.type).toBe('isNotNull');
    });
  });

  describe('InNode', () => {
    it('inline values', () => {
      const node: InNode = {
        type: 'in',
        property: { type: 'property', name: 'role' },
        values: [
          { type: 'literal', value: 'admin' },
          { type: 'literal', value: 'mod' }
        ]
      };
      expect(node.type).toBe('in');
      expect(node.values).toHaveLength(2);
    });

    it('external array reference', () => {
      const node: InNode = {
        type: 'in',
        property: { type: 'property', name: 'role' },
        valuesRef: 0
      };
      expect(node.valuesRef).toBe(0);
    });
  });

  describe('MethodNode', () => {
    it('includes method', () => {
      const node: MethodNode = {
        type: 'method',
        method: 'includes',
        object: { type: 'property', name: 'name' },
        args: [{ type: 'literal', value: 'foo' }]
      };
      expect(node.method).toBe('includes');
    });
  });

  describe('JsonPathExpression', () => {
    it('is the canonical jsonPath node assignable to ExpressionNode', () => {
      const node: JsonPathExpression = {
        type: 'jsonPath',
        column: 'preferences',
        path: ['display', 'theme'],
        cast: 'text'
      };
      const expr: ExpressionNode = node;
      expect(expr.type).toBe('jsonPath');
    });

    it('accepts a bare jsonPath literal in the ExpressionNode union', () => {
      const expr: ExpressionNode = { type: 'jsonPath', column: 'prefs', path: ['theme'] };
      expect(expr.type).toBe('jsonPath');
    });

    it('keeps the deprecated JsonPathNode alias structurally identical (back-compat)', () => {
      const canonical: JsonPathExpression = { type: 'jsonPath', column: 'c', path: ['a', 'b'] };
      // Mutual assignability proves the alias is the same type, not a divergent copy.
      const asAlias: JsonPathNode = canonical;
      const backToCanonical: JsonPathExpression = asAlias;
      expect(backToCanonical).toBe(canonical);
    });
  });

  describe('UnsupportedNode', () => {
    it('carries syntaxKind and description', () => {
      const node: UnsupportedNode = {
        type: 'unsupported',
        syntaxKind: 123,
        description: 'ternary not supported'
      };
      expect(node.type).toBe('unsupported');
      expect(node.syntaxKind).toBe(123);
    });
  });
});
