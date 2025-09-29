import type { ExpressionNode } from './ast/Nodes';
import { LogicalOperator } from './ast/Nodes';
/**
 * Specification pattern: composable, testable business rules that can be
 * converted to an expression tree for SQL generation when possible.
 */
export interface Specification<T> {
  /** Return AST representation for SQL generation or null when not supported. */
  toExpression(): ExpressionNode | null;
  /** Evaluate rule in memory for fallback filtering. */
  test(entity: T): boolean;
}
/** Composite specification combining child specs with a logical operator. */
export declare class CompositeSpecification<T> implements Specification<T> {
  private readonly operator;
  private readonly specs;
  constructor(operator: LogicalOperator, specs: Array<Specification<T>>);
  toExpression(): ExpressionNode | null;
  test(entity: T): boolean;
}
/** Leaf specification based on a predicate function with optional AST. */
export declare class PredicateSpecification<T> implements Specification<T> {
  private readonly predicate;
  private readonly expression;
  constructor(predicate: (entity: T) => boolean, expression: ExpressionNode | null);
  toExpression(): ExpressionNode | null;
  test(entity: T): boolean;
}
/** Helper factory with logical combinators. */
export declare const Specs: {
  and<T>(...specs: Array<Specification<T>>): Specification<T>;
  or<T>(...specs: Array<Specification<T>>): Specification<T>;
};
//# sourceMappingURL=Specification.d.ts.map
