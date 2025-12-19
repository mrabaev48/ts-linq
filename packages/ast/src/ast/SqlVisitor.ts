import type { BinaryExpressionNode, ExpressionNode, LogicalExpressionNode } from './Nodes';
import type { SqlParameter } from '@ts-linq/types';
import { BinaryVisitor } from '../visitors/BinaryVisitor';
import { LogicalVisitor } from '../visitors/LogicalVisitor';

/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Accepts an optional quoteIdentifier function for dialect-specific identifier quoting.
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  private readonly quoteIdentifier?: (name: string) => string;

  constructor(quoteIdentifier?: (name: string) => string) {
    this.quoteIdentifier = quoteIdentifier;
  }

  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] } {
    if (node.type === 'BinaryExpression')
      return this.binary.visit(node as BinaryExpressionNode, this.quoteIdentifier);
    if (node.type === 'LogicalExpression')
      return this.logical.visit(node as LogicalExpressionNode, (n) => this.toSql(n));
    return { condition: '1=1', parameters: [] };
  }
}
