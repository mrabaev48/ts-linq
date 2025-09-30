import { SqlVisitor } from '../../src/query/ast/SqlVisitor';
import type { ExpressionNode } from '../../src/query/ast/Nodes';

describe('SqlVisitor + LogicalVisitor', () => {
  const v = new SqlVisitor();

  test('binary expression', () => {
    const node: ExpressionNode = {
      type: 'BinaryExpression',
      operator: '>=',
      left: { type: 'Identifier', name: 'age' },
      right: { type: 'Literal', value: 18 }
    } as unknown as ExpressionNode;
    const res = v.toSql(node);
    expect(res.condition).toBe('age >= ?');
    expect(res.parameters).toEqual([18]);
  });

  test('nested logical (age>=18 AND (name="A" OR name="B"))', () => {
    const node: ExpressionNode = {
      type: 'LogicalExpression',
      operator: 0, // LogicalOperator.And
      expressions: [
        {
          type: 'BinaryExpression',
          operator: '>=',
          left: { type: 'Identifier', name: 'age' },
          right: { type: 'Literal', value: 18 }
        },
        {
          type: 'LogicalExpression',
          operator: 1, // LogicalOperator.Or
          expressions: [
            {
              type: 'BinaryExpression',
              operator: '=',
              left: { type: 'Identifier', name: 'name' },
              right: { type: 'Literal', value: 'A' }
            },
            {
              type: 'BinaryExpression',
              operator: '=',
              left: { type: 'Identifier', name: 'name' },
              right: { type: 'Literal', value: 'B' }
            }
          ]
        }
      ]
    } as unknown as ExpressionNode;

    const res = v.toSql(node);
    expect(res.condition).toBe('age >= ? AND name = ? OR name = ?');
    expect(res.parameters).toEqual([18, 'A', 'B']);
  });
});
