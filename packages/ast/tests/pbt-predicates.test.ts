import 'reflect-metadata';
import fc from 'fast-check';
import { PredicateParser } from '../src';
import type { ExpressionNode, BinaryExpressionNode, LogicalExpressionNode } from '../src';
import { ComparisonOperator, LogicalOperator } from '../src';

type Row = { price: number; stock: number };

function isBinary(node: ExpressionNode): node is BinaryExpressionNode {
  return (node as { type?: string }).type === 'BinaryExpression';
}

function isLogical(node: ExpressionNode): node is LogicalExpressionNode {
  return (node as { type?: string }).type === 'LogicalExpression';
}

function evalAst(node: ExpressionNode, row: Row): boolean {
  if (isBinary(node)) {
    let leftValue: number | string | boolean | null;
    switch (node.left.name) {
      case 'price':
        leftValue = row.price;
        break;
      case 'stock':
        leftValue = row.stock;
        break;
      default:
        leftValue = null;
    }
    const rightValue = node.right.value;
    switch (node.operator) {
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
  if (isLogical(node)) {
    if (node.operator === LogicalOperator.And) {
      return node.expressions.every((e) => evalAst(e, row));
    }
    return node.expressions.some((e) => evalAst(e, row));
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
