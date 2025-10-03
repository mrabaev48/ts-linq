import 'reflect-metadata';
import { LogicalVisitor } from '../src';
import type {
  ExpressionNode,
  LogicalExpressionNode,
  BinaryExpressionNode,
  IdentifierNode,
  LiteralNode
} from '@ts-linq/ast';
import { ComparisonOperator, LogicalOperator } from '@ts-linq/ast';

describe('LogicalVisitor', () => {
  const lv = new LogicalVisitor();

  function isBinary(n: ExpressionNode): n is BinaryExpressionNode {
    return (n as { type?: string }).type === 'BinaryExpression';
  }

  function visit(n: ExpressionNode) {
    if (isBinary(n)) {
      const left = n.left;
      const right = n.right;
      return { condition: `${left.name} ${n.operator} ?`, parameters: [right.value] };
    }
    return lv.visit(n as LogicalExpressionNode, visit);
  }

  it('AND combines sub-conditions', () => {
    const ageGte: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Gte,
      left: { type: 'Identifier', name: 'age' },
      right: { type: 'Literal', value: 18 }
    };
    const activeEq: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Eq,
      left: { type: 'Identifier', name: 'active' },
      right: { type: 'Literal', value: true }
    };
    const node: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: LogicalOperator.And,
      expressions: [ageGte as ExpressionNode, activeEq as ExpressionNode]
    };
    const res = lv.visit(node, visit);
    expect(res.condition).toBe('age >= ? AND active = ?');
    expect(res.parameters).toEqual([18, true]);
  });

  it('OR combines sub-conditions', () => {
    const roleAdmin: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Eq,
      left: { type: 'Identifier', name: 'role' },
      right: { type: 'Literal', value: 'admin' }
    };
    const roleEditor: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Eq,
      left: { type: 'Identifier', name: 'role' },
      right: { type: 'Literal', value: 'editor' }
    };
    const node: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: LogicalOperator.Or,
      expressions: [roleAdmin as ExpressionNode, roleEditor as ExpressionNode]
    };
    const res = lv.visit(node, visit);
    expect(res.condition).toBe('role = ? OR role = ?');
    expect(res.parameters).toEqual(['admin', 'editor']);
  });
});
