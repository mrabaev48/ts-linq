import { SqlVisitor } from '../src';
import type { BinaryExpressionNode, LogicalExpressionNode } from '@ts-linq/ast';
import { LogicalOperator, ComparisonOperator } from '@ts-linq/ast';

describe('SqlVisitor + LogicalVisitor', () => {
  const v = new SqlVisitor();

  test('binary expression', () => {
    const node: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Gte,
      left: { type: 'Identifier', name: 'age' },
      right: { type: 'Literal', value: 18 }
    };
    const res = v.toSql(node);
    expect(res.condition).toBe('age >= ?');
    expect(res.parameters).toEqual([18]);
  });

  test('nested logical (age>=18 AND (name="A" OR name="B"))', () => {
    const ageGte: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Gte,
      left: { type: 'Identifier', name: 'age' },
      right: { type: 'Literal', value: 18 }
    };
    const nameEqA: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Eq,
      left: { type: 'Identifier', name: 'name' },
      right: { type: 'Literal', value: 'A' }
    };
    const nameEqB: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Eq,
      left: { type: 'Identifier', name: 'name' },
      right: { type: 'Literal', value: 'B' }
    };
    const innerOr: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: LogicalOperator.Or,
      expressions: [nameEqA, nameEqB]
    };
    const node: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: LogicalOperator.And,
      expressions: [ageGte, innerOr]
    };

    const res = v.toSql(node);
    expect(res.condition).toBe('age >= ? AND name = ? OR name = ?');
    expect(res.parameters).toEqual([18, 'A', 'B']);
  });
});
