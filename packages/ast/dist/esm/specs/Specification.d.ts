import type { ExpressionNode } from '../ast/Nodes';
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
export declare class CompositeSpecification<T> implements Specification<T> {
    private readonly operator;
    private readonly specs;
    constructor(operator: LogicalOperator, specs: Array<Specification<T>>);
    toExpression(): ExpressionNode | null;
    test(entity: T): boolean;
}
/** Листовая спецификация на основе предиката с опциональным AST. */
export declare class PredicateSpecification<T> implements Specification<T> {
    private readonly predicate;
    private readonly expression;
    constructor(predicate: (entity: T) => boolean, expression: ExpressionNode | null);
    toExpression(): ExpressionNode | null;
    test(entity: T): boolean;
}
/** Хелперы для логических комбинаторов. */
export declare const Specs: {
    and<T>(...specs: Array<Specification<T>>): Specification<T>;
    or<T>(...specs: Array<Specification<T>>): Specification<T>;
};
//# sourceMappingURL=Specification.d.ts.map