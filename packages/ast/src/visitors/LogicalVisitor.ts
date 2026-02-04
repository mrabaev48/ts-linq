import type { ExpressionNode, LogicalExpressionNode } from '../ast/Nodes';
import { LogicalOperator } from '../ast/Nodes';
import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '../errors';

export class LogicalVisitor {
  public visit(
    node: LogicalExpressionNode,
    visit: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] }
  ): { condition: string; parameters: SqlParameter[] } {
    if (node.expressions.length === 0) {
      throw new AstSqlGenerationError(
        'EMPTY_LOGICAL_EXPRESSION',
        'LogicalExpression.expressions must not be empty.',
        { nodeType: node.type }
      );
    }
    const parts: string[] = [];
    const params: SqlParameter[] = [];
    for (const expr of node.expressions) {
      const result = visit(expr);
      parts.push(result.condition);
      params.push(...result.parameters);
    }
    const joiner = node.operator === LogicalOperator.And ? ' AND ' : ' OR ';
    // Wrap to preserve semantics for nested boolean expressions.
    return { condition: `(${parts.join(joiner)})`, parameters: params };
  }
}
