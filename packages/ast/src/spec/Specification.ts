import type { ExpressionNode, LogicalNode } from '../ast/Nodes';

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
export class CompositeSpecification<T> implements Specification<T> {
  private readonly operator: '&&' | '||';
  private readonly specs: Array<Specification<T>>;

  constructor(operator: '&&' | '||', specs: Array<Specification<T>>) {
    this.operator = operator;
    this.specs = specs;
  }

  toExpression(): ExpressionNode | null {
    const exprs = this.specs
      .map((s) => s.toExpression())
      .filter((e): e is ExpressionNode => e !== null);
    if (exprs.length === 0) return null;
    if (exprs.length === 1) return exprs[0]!;

    // Fold the list into a left-associative LogicalNode tree
    let result: LogicalNode = {
      type: 'logical',
      operator: this.operator,
      left: exprs[0]!,
      right: exprs[1]!,
    };
    for (let i = 2; i < exprs.length; i++) {
      result = { type: 'logical', operator: this.operator, left: result, right: exprs[i]! };
    }
    return result;
  }

  test(entity: T): boolean {
    if (this.operator === '&&') return this.specs.every((s) => s.test(entity));
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
    return new CompositeSpecification<T>('&&', specs);
  },
  or<T>(...specs: Array<Specification<T>>): Specification<T> {
    return new CompositeSpecification<T>('||', specs);
  },
};
