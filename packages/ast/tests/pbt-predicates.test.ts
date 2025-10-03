import 'reflect-metadata';
import fc from 'fast-check';
import { PredicateParser } from '@ts-linq/ast';
import type { ExpressionNode, BinaryExpressionNode, LogicalExpressionNode } from '@ts-linq/ast';
import { ComparisonOperator, LogicalOperator } from '@ts-linq/ast';

type Row = { price: number; stock: number };

function evalAst(node: ExpressionNode, row: Row): boolean {
  if (node.type === 'BinaryExpression') {
    const n = node as BinaryExpressionNode;
    const leftValue = (row as Record<string, unknown>)[n.left.name] as
      | number
      | string
      | boolean
      | null;
    const rightValue = n.right.value;
    switch (n.operator) {
      case ComparisonOperator.Eq:
        return leftValue === rightValue;
      case ComparisonOperator.Gte:
        return (leftValue as number) >= (rightValue as number);
      case ComparisonOperator.Lte:
        return (leftValue as number) <= (rightValue as number);
      case ComparisonOperator.Gt:
        return (leftValue as number) > (rightValue as number);
      case ComparisonOperator.Lt:
        return (leftValue as number) < (rightValue as number);
      default:
        return false;
    }
  }
  if (node.type === 'LogicalExpression') {
    const n = node as LogicalExpressionNode;
    if (n.operator === LogicalOperator.And) {
      return n.expressions.every((e) => evalAst(e, row));
    }
    return n.expressions.some((e) => evalAst(e, row));
  }
  return true;
}

describe('Property-based: predicate AST vs JS semantics (no core dependency)', () => {
  const parser = new PredicateParser<Row>();

  test('a => a.price >= X && a.stock > Y matches JS filter semantics when parsed', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.integer({ min: -1000, max: 1000 }),
            stock: fc.integer({ min: -1000, max: 1000 })
          }),
          { maxLength: 50 }
        ),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (rows, X, Y) => {
          const pred = (a: Row) => a.price >= X && a.stock > Y;
          const ast = parser.parse(pred);
          if (!ast) return true;
          const js = rows.filter(pred);
          const evalRes = rows.filter((r) => evalAst(ast, r));
          expect(evalRes).toEqual(js);
          return true;
        }
      ),
      { verbose: false }
    );
  });
});
