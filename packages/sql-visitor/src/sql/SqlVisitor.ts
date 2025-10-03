import type { BinaryExpressionNode, ExpressionNode, LogicalExpressionNode } from '@ts-linq/ast';
import { BinaryVisitor } from '../visitors/BinaryVisitor';
import { LogicalVisitor } from '../visitors/LogicalVisitor';
import type { SqlParameter } from '../visitors/BinaryVisitor';

export class SqlVisitor {
  private readonly binary = new BinaryVisitor();
  private readonly logical = new LogicalVisitor();

  public toSql(node: ExpressionNode): { condition: string; parameters: SqlParameter[] } {
    if (node.type === 'BinaryExpression') return this.binary.visit(node as BinaryExpressionNode);
    if (node.type === 'LogicalExpression')
      return this.logical.visit(node as LogicalExpressionNode, (n) => this.toSql(n));
    return { condition: '1=1', parameters: [] };
  }
}
