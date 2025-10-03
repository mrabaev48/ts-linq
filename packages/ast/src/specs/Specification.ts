import type { ExpressionNode, LogicalExpressionNode } from '../ast/Nodes';
import { LogicalOperator } from '../ast/Nodes';

/**
 * Паттерн спецификаций: компонуемые, тестируемые бизнес-правила,
 * которые при возможности конвертируются в дерево выражений для генерации SQL.
 */
export interface Specification<T> {
  toExpression(): ExpressionNode | null;
  test(entity: T): boolean;
}

/** Составная спецификация, объединяющая дочерние через логический оператор. */
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

/** Листовая спецификация на основе предиката с опциональным AST. */
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

/** Хелперы для логических комбинаторов. */
export const Specs = {
  and<T>(...specs: Array<Specification<T>>): Specification<T> {
    return new CompositeSpecification<T>(LogicalOperator.And, specs);
  },
  or<T>(...specs: Array<Specification<T>>): Specification<T> {
    return new CompositeSpecification<T>(LogicalOperator.Or, specs);
  }
};
