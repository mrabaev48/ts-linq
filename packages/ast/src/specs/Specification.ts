import type { ExpressionNode, LogicalExpressionNode } from '../ast/Nodes';
import { LogicalOperator } from '../ast/Nodes';

/**
 * Specification pattern: composable, testable business rules that can be
 * converted into an expression tree for SQL generation when possible.
 */
export interface Specification<T> {
  toExpression(): ExpressionNode | null;
  test(entity: T): boolean;
}

/** Composite specification combining child specs with a logical operator. */
export class CompositeSpecification<T> implements Specification<T> {
  private readonly operator: LogicalOperator;
  private readonly specs: Array<Specification<T>>;
  constructor(operator: LogicalOperator, specs: Array<Specification<T>>) {
    this.operator = operator;
    this.specs = specs;
  }
  toExpression(): ExpressionNode | null {
    const exprs = this.specs.map((s) => s.toExpression()).filter((e): e is ExpressionNode => !!e);
    if (exprs.length === 0) return null;
    const node: LogicalExpressionNode = {
      type: 'LogicalExpression',
      operator: this.operator,
      expressions: exprs
    };
    return node;
  }
  test(entity: T): boolean {
    if (this.operator === LogicalOperator.And) return this.specs.every((s) => s.test(entity));
    return this.specs.some((s) => s.test(entity));
  }
}

/** Leaf specification based on a predicate function with optional AST. */
export class PredicateSpecification<T> implements Specification<T> {
  private readonly predicate: (entity: T) => boolean;
  private readonly expression: ExpressionNode | null;
  constructor(predicate: (entity: T) => boolean, expression: ExpressionNode | null) {
    this.predicate = predicate;
    this.expression = expression;
  }
  toExpression(): ExpressionNode | null {
    return this.expression;
  }
  test(entity: T): boolean {
    return this.predicate(entity);
  }
}

/** Helper factory with logical combinators. */
export const Specs = {
  and<T>(...specs: Array<Specification<T>>): Specification<T> {
    return new CompositeSpecification<T>(LogicalOperator.And, specs);
  },
  or<T>(...specs: Array<Specification<T>>): Specification<T> {
    return new CompositeSpecification<T>(LogicalOperator.Or, specs);
  }
};
