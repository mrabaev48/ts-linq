import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { SqlVisitor, type ExpressionNode } from '@ts-linq/ast';

type Row = { price: number; stock: number };

/**
 * Property-based testing: validates that SQL generation from compiled AST
 * matches JavaScript filter semantics.
 */
describe('Property-Based Testing: Predicate SQL vs JS Filtering', () => {
  const visitor = new SqlVisitor();

  it('should match JS filter semantics for: a.price >= X && a.stock > Y (ParameterRef)', () => {
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
          const ast: ExpressionNode = {
            type: 'logical',
            operator: '&&',
            left: {
              type: 'binary',
              left: { type: 'property', path: ['price'] },
              operator: '>=',
              right: { type: 'parameterRef', index: 0 }
            },
            right: {
              type: 'binary',
              left: { type: 'property', path: ['stock'] },
              operator: '>',
              right: { type: 'parameterRef', index: 1 }
            }
          };

          const { parameters } = visitor.toSql(ast, [X, Y]);

          const js = rows.filter(pred);

          const [pX, pY] = parameters as number[];
          const sqlSim = rows.filter((r) => r.price >= pX && r.stock > pY);

          expect(sqlSim).toEqual(js);
          return true;
        }
      ),
      { verbose: false, numRuns: 100 }
    );
  });

  it('should preserve filtering with equality predicates', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            price: fc.integer({ min: 0, max: 100 }),
            stock: fc.integer({ min: 0, max: 50 })
          }),
          { maxLength: 30 }
        ),
        fc.integer({ min: 0, max: 100 }),
        (rows, targetPrice) => {
          const pred = (a: Row) => a.price === targetPrice;
          const ast: ExpressionNode = {
            type: 'binary',
            left: { type: 'property', path: ['price'] },
            operator: '===',
            right: { type: 'parameterRef', index: 0 }
          };

          const { parameters } = visitor.toSql(ast, [targetPrice]);

          const js = rows.filter(pred);
          const [pPrice] = parameters as number[];
          const sqlSim = rows.filter((r) => r.price === pPrice);

          expect(sqlSim).toEqual(js);
          return true;
        }
      ),
      { verbose: false, numRuns: 50 }
    );
  });
});
