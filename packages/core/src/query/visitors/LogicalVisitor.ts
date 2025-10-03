import type { ExpressionNode, LogicalExpressionNode } from '@ts-linq/ast';
import { LogicalOperator } from '@ts-linq/ast';
import type { SqlParameter } from '../../types';

export class LogicalVisitor {
  public visit(
    node: LogicalExpressionNode,
    visit: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] }
  ): { condition: string; parameters: SqlParameter[] } {
    const parts: string[] = [];
    const params: SqlParameter[] = [];
    for (const expr of node.expressions) {
      const result = visit(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
    return { condition: parts.join(joiner), parameters: params };
  }
}
