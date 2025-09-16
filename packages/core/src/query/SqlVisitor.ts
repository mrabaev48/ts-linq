import type {
  BinaryExpressionNode,
  ExpressionNode,
  IdentifierNode,
  LiteralNode,
  LogicalExpressionNode
} from './Nodes';
import { LogicalOperator } from './Nodes';
import type { SqlParameter } from '../types';

/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export class SqlVisitor {
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] } {
    switch (node.type) {
      case 'BinaryExpression':
        return this.visitBinary(node as BinaryExpressionNode);
      case 'LogicalExpression':
        return this.visitLogical(node as LogicalExpressionNode);
      default:
        return { condition: '1=1', parameters: [] };
    }
  }

  /**
   * Handle a binary comparison node.
   */
  private visitBinary(node: BinaryExpressionNode): {
    condition: string;
    parameters: SqlParameter[];
  } {
    const column = node.left.name;
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
  }

  /**
   * Handle a logical AND/OR node by concatenating child results.
   */
  private visitLogical(node: LogicalExpressionNode): {
    condition: string;
    parameters: SqlParameter[];
  } {
    const parts: string[] = [];
    const params: SqlParameter[] = [];
    for (const expr of node.expressions) {
      const result = this.toSql(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
    return { condition: parts.join(joiner), parameters: params };
  }
}
