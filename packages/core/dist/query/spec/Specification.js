'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Specs = exports.PredicateSpecification = exports.CompositeSpecification = void 0;
const Nodes_1 = require('../ast/Nodes');
/** Composite specification combining child specs with a logical operator. */
class CompositeSpecification {
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
    if (this.operator === Nodes_1.LogicalOperator.And)
      return this.specs.every((s) => s.test(entity));
    return this.specs.some((s) => s.test(entity));
  }
}
exports.CompositeSpecification = CompositeSpecification;
/** Leaf specification based on a predicate function with optional AST. */
class PredicateSpecification {
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
exports.PredicateSpecification = PredicateSpecification;
/** Helper factory with logical combinators. */
exports.Specs = {
  and(...specs) {
    return new CompositeSpecification(Nodes_1.LogicalOperator.And, specs);
  },
  or(...specs) {
    return new CompositeSpecification(Nodes_1.LogicalOperator.Or, specs);
  }
};
//# sourceMappingURL=Specification.js.map
