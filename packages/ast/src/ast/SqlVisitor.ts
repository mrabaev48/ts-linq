import type { SqlParameter } from '@ts-linq/types';
import { BinaryVisitor } from '../visitors/BinaryVisitor';
import { LogicalVisitor } from '../visitors/LogicalVisitor';
import { UnaryVisitor } from '../visitors/UnaryVisitor';
import { AstSqlGenerationError } from '../errors';
import type { BinaryExpressionNode, ExpressionNode, LogicalExpressionNode, UnaryExpressionNode } from './Nodes';

/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();
  private readonly unary = new UnaryVisitor();
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   *
   * @param node Expression tree root (BinaryExpression or LogicalExpression).
   * @param inputParameters Optional runtime parameters referenced by `ParameterRef` nodes.
   * @throws `AstSqlGenerationError` when the AST is invalid or unsupported.
   */
  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] };
  public toSql(
    node: ExpressionNode,
    inputParameters: readonly SqlParameter[]
  ): { condition: string; parameters: SqlParameter[] };
  public toSql(
    node: ExpressionNode,
    inputParameters: readonly SqlParameter[] = []
  ): { condition: string; parameters: SqlParameter[] } {
    if (node.type === 'BinaryExpression')
      return this.binary.visit(node as BinaryExpressionNode, inputParameters);
    if (node.type === 'LogicalExpression')
      return this.logical.visit(node as LogicalExpressionNode, (n) => this.toSql(n, inputParameters));
    if (node.type === 'UnaryExpression')
      return this.unary.visit(node as UnaryExpressionNode, (n) => this.toSql(n, inputParameters));
    throw new AstSqlGenerationError(
      'UNSUPPORTED_NODE_TYPE',
      `Unsupported root node type: '${node.type}'.`,
      { nodeType: node.type }
    );
  }
}
