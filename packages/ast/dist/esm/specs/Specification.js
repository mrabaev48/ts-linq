import { LogicalOperator } from '../ast/Nodes';
/** Composite specification combining child specs with a logical operator. */
export class CompositeSpecification {
  constructor(operator, specs) {
    this.operator = operator;
    this.specs = specs;
  }
  toExpression() {
    const exprs = this.specs.map((s) => s.toExpression()).filter((e) => !!e);
    if (exprs.length === 0) return null;
    const node = {
      type: 'LogicalExpression',
      operator: this.operator,
      expressions: exprs
    };
    return node;
  }
  test(entity) {
    if (this.operator === LogicalOperator.And) return this.specs.every((s) => s.test(entity));
    return this.specs.some((s) => s.test(entity));
  }
}
/** Leaf specification based on a predicate function with optional AST. */
export class PredicateSpecification {
  constructor(predicate, expression) {
    this.predicate = predicate;
    this.expression = expression;
  }
  toExpression() {
    return this.expression;
  }
  test(entity) {
    return this.predicate(entity);
  }
}
/** Helper factory with logical combinators. */
export const Specs = {
  and(...specs) {
    return new CompositeSpecification(LogicalOperator.And, specs);
  },
  or(...specs) {
    return new CompositeSpecification(LogicalOperator.Or, specs);
  }
};
//# sourceMappingURL=Specification.js.map
