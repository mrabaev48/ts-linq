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

/** Unary operators supported by the minimal AST. */
export enum UnaryOperator {
  Not = 'NOT'
}

import type { SqlParameter } from '@ts-linq/types';

/**
 * Base SQL-compatible literal value.
 *
 * Note: This mirrors `SqlParameter` to keep the AST serializable and safe for SQL parameterization.
 */
export type SqlLiteralValue = SqlParameter;

/** Literal value node (parameterized value). */
export interface LiteralNode {
  type: 'Literal';
  value: SqlLiteralValue;
}

/**
 * Member access node representing a column/property path.
 *
 * Examples:
 * - `userId` -> `['userId']`
 * - `profile.age` -> `['profile','age']`
 */
export interface MemberAccessNode {
  type: 'MemberAccess';
  path: readonly string[];
}

/**
 * Reference to a runtime parameter by index.
 * The SQL generator must resolve it against `inputParameters[index]`.
 */
export interface ParameterRefNode {
  type: 'ParameterRef';
  index: number;
}

export interface BinaryExpressionNode {
  type: 'BinaryExpression';
  left: MemberAccessNode;
  operator: ComparisonOperator;
  right: LiteralNode | ParameterRefNode;
}

export interface LogicalExpressionNode {
  type: 'LogicalExpression';
  operator: LogicalOperator;
  expressions: readonly ExpressionNode[];
}

export interface UnaryExpressionNode {
  type: 'UnaryExpression';
  operator: UnaryOperator.Not;
  operand: ExpressionNode;
}

/**
 * Minimal query expression tree supported by `@ts-linq/ast`.
 *
 * This is a strict discriminated union: unknown node types are rejected by SQL generation.
 */
export type ExpressionNode =
  | LiteralNode
  | MemberAccessNode
  | ParameterRefNode
  | BinaryExpressionNode
  | LogicalExpressionNode
  | UnaryExpressionNode;
