import {
  LogicalOperator,
  ComparisonOperator,
  UnaryOperator,
  type ExpressionNode,
  type LiteralNode,
  type BinaryExpressionNode,
  type LogicalExpressionNode,
  type MemberAccessNode,
  type ParameterRefNode,
  type UnaryExpressionNode
} from '../src/ast/Nodes';

describe('AST Nodes', () => {
  describe('LogicalOperator enum', () => {
    it('should have AND operator', () => {
      expect(LogicalOperator.And).toBe('AND');
    });

    it('should have OR operator', () => {
      expect(LogicalOperator.Or).toBe('OR');
    });

    it('should have exactly 2 operators', () => {
      const operators = Object.values(LogicalOperator);
      expect(operators).toHaveLength(2);
      expect(operators).toEqual(['AND', 'OR']);
    });
  });

  describe('ComparisonOperator enum', () => {
    it('should have equality operator', () => {
      expect(ComparisonOperator.Eq).toBe('=');
    });

    it('should have greater than operator', () => {
      expect(ComparisonOperator.Gt).toBe('>');
    });

    it('should have greater than or equal operator', () => {
      expect(ComparisonOperator.Gte).toBe('>=');
    });

    it('should have less than operator', () => {
      expect(ComparisonOperator.Lt).toBe('<');
    });

    it('should have less than or equal operator', () => {
      expect(ComparisonOperator.Lte).toBe('<=');
    });

    it('should have exactly 5 comparison operators', () => {
      const operators = Object.values(ComparisonOperator);
      expect(operators).toHaveLength(5);
      expect(operators).toEqual(['=', '>', '>=', '<', '<=']);
    });
  });

  describe('UnaryOperator enum', () => {
    it('should have NOT operator', () => {
      expect(UnaryOperator.Not).toBe('NOT');
    });
  });

  describe('MemberAccessNode', () => {
    it('should represent a member access path', () => {
      const node: MemberAccessNode = {
        type: 'MemberAccess',
        path: ['userId']
      };

      expect(node.type).toBe('MemberAccess');
      expect(node.path).toEqual(['userId']);
    });

    it('should extend ExpressionNode', () => {
      const node: MemberAccessNode = {
        type: 'MemberAccess',
        path: ['profile', 'age']
      };

      const expr: ExpressionNode = node;
      expect(expr.type).toBe('MemberAccess');
    });
  });

  describe('ParameterRefNode', () => {
    it('should reference a runtime parameter by index', () => {
      const node: ParameterRefNode = {
        type: 'ParameterRef',
        index: 0
      };

      expect(node.type).toBe('ParameterRef');
      expect(node.index).toBe(0);
    });

    it('should extend ExpressionNode', () => {
      const node: ParameterRefNode = {
        type: 'ParameterRef',
        index: 1
      };

      const expr: ExpressionNode = node;
      expect(expr.type).toBe('ParameterRef');
    });
  });

  describe('LiteralNode', () => {
    it('should support string literals', () => {
      const node: LiteralNode = {
        type: 'Literal',
        value: 'test'
      };

      expect(node.type).toBe('Literal');
      expect(node.value).toBe('test');
    });

    it('should support number literals', () => {
      const node: LiteralNode = {
        type: 'Literal',
        value: 42
      };

      expect(node.value).toBe(42);
    });

    it('should support boolean literals', () => {
      const trueNode: LiteralNode = {
        type: 'Literal',
        value: true
      };

      const falseNode: LiteralNode = {
        type: 'Literal',
        value: false
      };

      expect(trueNode.value).toBe(true);
      expect(falseNode.value).toBe(false);
    });

    it('should support null literals', () => {
      const node: LiteralNode = {
        type: 'Literal',
        value: null
      };

      expect(node.value).toBe(null);
    });

    it('should extend ExpressionNode', () => {
      const node: LiteralNode = {
        type: 'Literal',
        value: 100
      };

      const expr: ExpressionNode = node;
      expect(expr.type).toBe('Literal');
    });
  });

  describe('BinaryExpressionNode', () => {
    it('should represent a comparison expression', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gt,
        right: { type: 'Literal', value: 18 }
      };

      expect(node.type).toBe('BinaryExpression');
      expect(node.left.path).toEqual(['age']);
      expect(node.operator).toBe('>');
      expect(node.right.type).toBe('Literal');
      if (node.right.type === 'Literal') {
        expect(node.right.value).toBe(18);
      }
    });

    it('should support all comparison operators', () => {
      const operators = [
        ComparisonOperator.Eq,
        ComparisonOperator.Gt,
        ComparisonOperator.Gte,
        ComparisonOperator.Lt,
        ComparisonOperator.Lte
      ];

      operators.forEach((op) => {
        const node: BinaryExpressionNode = {
          type: 'BinaryExpression',
          left: { type: 'MemberAccess', path: ['x'] },
          operator: op,
          right: { type: 'Literal', value: 10 }
        };

        expect(node.operator).toBe(op);
      });
    });

    it('should extend ExpressionNode', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['id'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 1 }
      };

      const expr: ExpressionNode = node;
      expect(expr.type).toBe('BinaryExpression');
    });
  });

  describe('LogicalExpressionNode', () => {
    it('should represent AND expression', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gt,
        right: { type: 'Literal', value: 18 }
      };
      
      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['status'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'active' }
      };
      
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [expr1, expr2]
      };

      expect(node.type).toBe('LogicalExpression');
      expect(node.operator).toBe('AND');
      expect(node.expressions).toHaveLength(2);
    });

    it('should represent OR expression', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['role'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'admin' }
      };
      
      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['role'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'moderator' }
      };
      
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.Or,
        expressions: [expr1, expr2]
      };

      expect(node.operator).toBe('OR');
      expect(node.expressions).toHaveLength(2);
    });

    it('should support nested logical expressions', () => {
      const activeExpr: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['active'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: true }
      };
      
      const adminExpr: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['role'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'admin' }
      };
      
      const ownerExpr: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['role'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'owner' }
      };
      
      const roleOrExpr: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.Or,
        expressions: [adminExpr, ownerExpr]
      };
      
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [activeExpr, roleOrExpr]
      };

      expect(node.expressions).toHaveLength(2);
      expect(node.expressions[1].type).toBe('LogicalExpression');
    });

    it('should extend ExpressionNode', () => {
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: []
      };

      const expr: ExpressionNode = node;
      expect(expr.type).toBe('LogicalExpression');
    });

    it('should support empty expressions array', () => {
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: []
      };

      expect(node.expressions).toHaveLength(0);
    });
  });

  describe('UnaryExpressionNode', () => {
    it('should represent NOT expression over a member access', () => {
      const node: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: { type: 'MemberAccess', path: ['isActive'] }
      };

      expect(node.type).toBe('UnaryExpression');
      expect(node.operator).toBe('NOT');
      expect(node.operand.type).toBe('MemberAccess');
    });

    it('should extend ExpressionNode', () => {
      const node: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: { type: 'MemberAccess', path: ['flag'] }
      };

      const expr: ExpressionNode = node;
      expect(expr.type).toBe('UnaryExpression');
    });
  });
});
