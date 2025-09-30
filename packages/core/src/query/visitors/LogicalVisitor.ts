import type { LogicalExpressionNode } from '../ast/Nodes';
import { LogicalOperator } from '../ast/Nodes';
import type { SqlParameter } from '../../types';
import { SqlVisitor } from '../ast/SqlVisitor';

export class LogicalVisitor {
  private readonly root = new SqlVisitor();

  public visit(node: LogicalExpressionNode): { condition: string; parameters: SqlParameter[] } {
    const parts: string[] = [];
    const params: SqlParameter[] = [];
    for (const expr of node.expressions) {
      const result = this.root.toSql(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
    return { condition: parts.join(joiner), parameters: params };
  }
}
