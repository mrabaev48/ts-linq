/** Логические операторы для составных булевых выражений. */
export declare enum LogicalOperator {
    And = "AND",
    Or = "OR"
}
/** Операторы сравнения, поддерживаемые минимальным AST. */
export declare enum ComparisonOperator {
    Eq = "=",
    Gt = ">",
    Gte = ">=",
    Lt = "<",
    Lte = "<="
}
/** Базовый интерфейс всех AST-узлов. */
export interface ExpressionNode {
    type: string;
}
export interface IdentifierNode extends ExpressionNode {
    type: 'Identifier';
    name: string;
}
export interface LiteralNode extends ExpressionNode {
    type: 'Literal';
    value: string | number | boolean | null;
}
export interface BinaryExpressionNode extends ExpressionNode {
    type: 'BinaryExpression';
    left: IdentifierNode;
    operator: ComparisonOperator;
    right: LiteralNode;
}
export interface LogicalExpressionNode extends ExpressionNode {
    type: 'LogicalExpression';
    operator: LogicalOperator;
    expressions: ExpressionNode[];
}
//# sourceMappingURL=Nodes.d.ts.map