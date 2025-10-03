import 'reflect-metadata';
import { BinaryVisitor } from '../src';
import type { BinaryExpressionNode } from '@ts-linq/ast';
import { ComparisonOperator } from '@ts-linq/ast';

describe('BinaryVisitor', () => {
  const v = new BinaryVisitor();

  it('renders >= with numeric literal', () => {
    const node: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Gte,
      left: { type: 'Identifier', name: 'age' },
      right: { type: 'Literal', value: 18 }
    };
    const res = v.visit(node);
    expect(res.condition).toBe('age >= ?');
    expect(res.parameters).toEqual([18]);
  });

  it('renders = with string literal', () => {
    const node: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: ComparisonOperator.Eq,
      left: { type: 'Identifier', name: 'name' },
      right: { type: 'Literal', value: 'A' }
    };
    const res = v.visit(node);
    expect(res.condition).toBe('name = ?');
    expect(res.parameters).toEqual(['A']);
  });
});
