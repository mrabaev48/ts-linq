import { BinaryVisitor } from '../src/visitors/BinaryVisitor';
import { LogicalVisitor } from '../src/visitors/LogicalVisitor';
import { SqlVisitor } from '../src/ast/SqlVisitor';
import {
  ComparisonOperator,
  LogicalOperator,
  UnaryOperator,
  type BinaryExpressionNode,
  type LogicalExpressionNode,
  type UnaryExpressionNode,
  type ExpressionNode
} from '../src/ast/Nodes';
import { AstSqlGenerationError } from '../src/errors';

describe('AST Visitors', () => {
  describe('BinaryVisitor', () => {
    let visitor: BinaryVisitor;

    beforeEach(() => {
      visitor = new BinaryVisitor();
    });

    it('should visit equality comparison', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['id'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 1 }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(id = ?)');
      expect(result.parameters).toEqual([1]);
    });

    it('should visit greater than comparison', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gt,
        right: { type: 'Literal', value: 18 }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(age > ?)');
      expect(result.parameters).toEqual([18]);
    });

    it('should visit greater than or equal comparison', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['salary'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'Literal', value: 50000 }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(salary >= ?)');
      expect(result.parameters).toEqual([50000]);
    });

    it('should visit less than comparison', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['price'] },
        operator: ComparisonOperator.Lt,
        right: { type: 'Literal', value: 100 }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(price < ?)');
      expect(result.parameters).toEqual([100]);
    });

    it('should visit less than or equal comparison', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['quantity'] },
        operator: ComparisonOperator.Lte,
        right: { type: 'Literal', value: 10 }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(quantity <= ?)');
      expect(result.parameters).toEqual([10]);
    });

    it('should handle string values', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['name'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'Alice' }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(name = ?)');
      expect(result.parameters).toEqual(['Alice']);
    });

    it('should handle boolean values', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['active'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: true }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(active = ?)');
      expect(result.parameters).toEqual([true]);
    });

    it('should handle null values', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['deletedAt'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: null }
      };

      const result = visitor.visit(node);

      expect(result.condition).toBe('(deletedAt = ?)');
      expect(result.parameters).toEqual([null]);
    });

    it('should resolve ParameterRef from input parameters', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'ParameterRef', index: 0 }
      };

      const result = visitor.visit(node, [21]);

      expect(result.condition).toBe('(age >= ?)');
      expect(result.parameters).toEqual([21]);
    });

    it('should throw on out-of-range ParameterRef index', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'ParameterRef', index: 1 }
      };

      expect(() => visitor.visit(node, [21])).toThrow(AstSqlGenerationError);
    });

    it('should throw on invalid MemberAccess path segment', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['profile', 'age-years'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'Literal', value: 18 }
      };

      expect(() => visitor.visit(node)).toThrow(AstSqlGenerationError);
    });
  });

  describe('LogicalVisitor', () => {
    let visitor: LogicalVisitor;

    beforeEach(() => {
      visitor = new LogicalVisitor();
    });

    it('should visit AND expression', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gt,
        right: { type: 'Literal', value: 18 }
      };

      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['active'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: true }
      };

      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [expr1, expr2]
      };

      const mockVisit = (n: ExpressionNode) => {
        if (n.type === 'BinaryExpression') {
          const binary = n as BinaryExpressionNode;
          const value = binary.right.type === 'Literal' ? binary.right.value : null;
          return {
            condition: `(${binary.left.path.join('.')} ${binary.operator} ?)`,
            parameters: [value]
          };
        }
        return { condition: '1=1', parameters: [] };
      };

      const result = visitor.visit(node, mockVisit);

      expect(result.condition).toBe('((age > ?) AND (active = ?))');
      expect(result.parameters).toEqual([18, true]);
    });

    it('should visit OR expression', () => {
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

      const mockVisit = (n: ExpressionNode) => {
        if (n.type === 'BinaryExpression') {
          const binary = n as BinaryExpressionNode;
          const value = binary.right.type === 'Literal' ? binary.right.value : null;
          return {
            condition: `(${binary.left.path.join('.')} ${binary.operator} ?)`,
            parameters: [value]
          };
        }
        return { condition: '1=1', parameters: [] };
      };

      const result = visitor.visit(node, mockVisit);

      expect(result.condition).toBe('((role = ?) OR (role = ?))');
      expect(result.parameters).toEqual(['admin', 'moderator']);
    });

    it('should handle multiple expressions', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['a'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 1 }
      };

      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['b'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 2 }
      };

      const expr3: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['c'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 3 }
      };

      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [expr1, expr2, expr3]
      };

      const mockVisit = (n: ExpressionNode) => {
        if (n.type === 'BinaryExpression') {
          const binary = n as BinaryExpressionNode;
          const value = binary.right.type === 'Literal' ? binary.right.value : null;
          return {
            condition: `(${binary.left.path.join('.')} ${binary.operator} ?)`,
            parameters: [value]
          };
        }
        return { condition: '1=1', parameters: [] };
      };

      const result = visitor.visit(node, mockVisit);

      expect(result.condition).toBe('((a = ?) AND (b = ?) AND (c = ?))');
      expect(result.parameters).toEqual([1, 2, 3]);
    });

    it('should handle empty expressions array', () => {
      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: []
      };

      const mockVisit = () => ({ condition: '1=1', parameters: [] });

      expect(() => visitor.visit(node, mockVisit)).toThrow(AstSqlGenerationError);
    });
  });

  describe('SqlVisitor', () => {
    let visitor: SqlVisitor;

    beforeEach(() => {
      visitor = new SqlVisitor();
    });

    it('should convert simple binary expression to SQL', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['userId'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 42 }
      };

      const result = visitor.toSql(node);

      expect(result.condition).toBe('(userId = ?)');
      expect(result.parameters).toEqual([42]);
    });

    it('should convert AND logical expression to SQL', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gt,
        right: { type: 'Literal', value: 18 }
      };

      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['active'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: true }
      };

      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [expr1, expr2]
      };

      const result = visitor.toSql(node);

      expect(result.condition).toBe('((age > ?) AND (active = ?))');
      expect(result.parameters).toEqual([18, true]);
    });

    it('should convert OR logical expression to SQL', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['status'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'pending' }
      };

      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['status'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'processing' }
      };

      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.Or,
        expressions: [expr1, expr2]
      };

      const result = visitor.toSql(node);

      expect(result.condition).toBe('((status = ?) OR (status = ?))');
      expect(result.parameters).toEqual(['pending', 'processing']);
    });

    it('should handle nested logical expressions', () => {
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

      const modExpr: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['role'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: 'moderator' }
      };

      const roleOrExpr: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.Or,
        expressions: [adminExpr, modExpr]
      };

      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [activeExpr, roleOrExpr]
      };

      const result = visitor.toSql(node);

      expect(result.condition).toBe('((active = ?) AND ((role = ?) OR (role = ?)))');
      expect(result.parameters).toEqual([true, 'admin', 'moderator']);
    });

    it('should return default condition for unknown node types', () => {
      const node = {
        type: 'UnknownExpression'
      } as unknown as ExpressionNode;

      expect(() => visitor.toSql(node)).toThrow(AstSqlGenerationError);
    });

    it('should handle complex queries with multiple operators', () => {
      const expr1: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['price'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'Literal', value: 10 }
      };

      const expr2: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['price'] },
        operator: ComparisonOperator.Lte,
        right: { type: 'Literal', value: 100 }
      };

      const expr3: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['inStock'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: true }
      };

      const node: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [expr1, expr2, expr3]
      };

      const result = visitor.toSql(node);

      expect(result.condition).toBe('((price >= ?) AND (price <= ?) AND (inStock = ?))');
      expect(result.parameters).toEqual([10, 100, true]);
    });

    it('should support ParameterRef at runtime via input parameters', () => {
      const node: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gte,
        right: { type: 'ParameterRef', index: 0 }
      };

      const result = visitor.toSql(node, [21]);

      expect(result.condition).toBe('(age >= ?)');
      expect(result.parameters).toEqual([21]);
    });

    it('should convert NOT over MemberAccess to (= false)', () => {
      const node: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: { type: 'MemberAccess', path: ['isActive'] }
      };

      const result = visitor.toSql(node);

      expect(result.condition).toBe('(isActive = ?)');
      expect(result.parameters).toEqual([false]);
    });

    it('should convert NOT over a logical expression to NOT (...)', () => {
      const a: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['age'] },
        operator: ComparisonOperator.Gt,
        right: { type: 'Literal', value: 18 }
      };
      const b: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'MemberAccess', path: ['isActive'] },
        operator: ComparisonOperator.Eq,
        right: { type: 'Literal', value: true }
      };
      const andExpr: LogicalExpressionNode = {
        type: 'LogicalExpression',
        operator: LogicalOperator.And,
        expressions: [a, b]
      };
      const notExpr: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: andExpr
      };

      const result = visitor.toSql(notExpr);

      expect(result.condition).toBe('(NOT ((age > ?) AND (isActive = ?)))');
      expect(result.parameters).toEqual([18, true]);
    });

    it('should support nested NOT', () => {
      const inner: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: { type: 'MemberAccess', path: ['isActive'] }
      };
      const outer: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: inner
      };

      const result = visitor.toSql(outer);

      expect(result.condition).toBe('(NOT (isActive = ?))');
      expect(result.parameters).toEqual([false]);
    });

    it('should throw on invalid unary operand type', () => {
      const node: UnaryExpressionNode = {
        type: 'UnaryExpression',
        operator: UnaryOperator.Not,
        operand: { type: 'Literal', value: true }
      };

      expect(() => visitor.toSql(node)).toThrow(AstSqlGenerationError);
    });
  });
});
