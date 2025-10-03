/** Logical operators used in compound boolean expressions. */
export enum LogicalOperator {
  And = 'AND',
  Or = 'OR'
}

/** Comparison operators supported by the minimal AST. */
export enum ComparisonOperator {
  Eq = '=',
  Gt = '>',
  Gte = '>=',
  Lt = '<',
  Lte = '<='
}

/** Base interface for all AST nodes. */
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
