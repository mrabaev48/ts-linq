import {
  BinaryExpressionNode,
  ExpressionNode,
  IdentifierNode,
  LiteralNode,
  LogicalExpressionNode,
  LogicalOperator
} from './Nodes';

/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export class SqlVisitor {
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  public toSql(node: ExpressionNode): { condition: string; parameters: any[] } {
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
  private visitBinary(node: BinaryExpressionNode): { condition: string; parameters: any[] } {
    const column = (node.left as IdentifierNode).name;
    const value = (node.right as LiteralNode).value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
  }

  /**
   * Handle a logical AND/OR node by concatenating child results.
   */
  private visitLogical(node: LogicalExpressionNode): { condition: string; parameters: any[] } {
    const parts: string[] = [];
    const params: any[] = [];
    for (const expr of node.expressions) {
      const result = this.toSql(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
    return { condition: parts.join(joiner), parameters: params };
  }
}
