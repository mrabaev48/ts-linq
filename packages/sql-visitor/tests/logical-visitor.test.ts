import 'reflect-metadata';
import { LogicalVisitor } from '../src';
import type { ExpressionNode, LogicalExpressionNode } from '@ts-linq/ast';
import { ComparisonOperator, LogicalOperator } from '@ts-linq/ast';

describe('LogicalVisitor', () => {
  const lv = new LogicalVisitor();

  function visit(n: ExpressionNode) {
    if (n.type === 'BinaryExpression') {
      const column = (n.left as any).name as string;
      const value = (n.right as any).value as string | number | boolean | null;
      return { condition: `${column} ${n.operator} ?`, parameters: [value] };
    }
    return lv.visit(n as LogicalExpressionNode, visit);
  }

  it('AND combines sub-conditions', () => {
    const node: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: LogicalOperator.And,
      expressions: [
        {
          type: 'BinaryExpression',
          operator: ComparisonOperator.Gte,
          left: { type: 'Identifier', name: 'age' },
          right: { type: 'Literal', value: 18 }
        },
        {
          type: 'BinaryExpression',
          operator: ComparisonOperator.Eq,
          left: { type: 'Identifier', name: 'active' },
          right: { type: 'Literal', value: true }
        }
      ]
    };
    const res = lv.visit(node, visit);
    expect(res.condition).toBe('age >= ? AND active = ?');
    expect(res.parameters).toEqual([18, true]);
  });

  it('OR combines sub-conditions', () => {
    const node: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: LogicalOperator.Or,
      expressions: [
        {
          type: 'BinaryExpression',
          operator: ComparisonOperator.Eq,
          left: { type: 'Identifier', name: 'role' },
          right: { type: 'Literal', value: 'admin' }
        },
        {
          type: 'BinaryExpression',
          operator: ComparisonOperator.Eq,
          left: { type: 'Identifier', name: 'role' },
          right: { type: 'Literal', value: 'editor' }
        }
      ]
    };
    const res = lv.visit(node, visit);
    expect(res.condition).toBe('role = ? OR role = ?');
    expect(res.parameters).toEqual(['admin', 'editor']);
  });
});
