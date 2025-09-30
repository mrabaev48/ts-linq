import type { BinaryExpressionNode, ExpressionNode, LogicalExpressionNode } from './Nodes';
import type { SqlParameter } from '../../types';
import { BinaryVisitor } from '../visitors/BinaryVisitor';
import { LogicalVisitor } from '../visitors/LogicalVisitor';

/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] } {
    if (node.type === 'BinaryExpression') return this.binary.visit(node as BinaryExpressionNode);
    if (node.type === 'LogicalExpression') return this.logical.visit(node as LogicalExpressionNode);
    return { condition: '1=1', parameters: [] };
  }
}
