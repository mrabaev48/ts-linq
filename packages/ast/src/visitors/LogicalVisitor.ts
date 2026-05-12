import type { ExpressionNode, LogicalNode } from '../ast/Nodes';
import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '../errors';

export class LogicalVisitor {
  public visit(
    node: LogicalNode,
    recurse: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] }
  ): { condition: string; parameters: SqlParameter[] } {
    const left = recurse(node.left);
    const right = recurse(node.right);

    if (left.condition === '' || right.condition === '') {
      throw new AstSqlGenerationError(
        'EMPTY_LOGICAL_BRANCH',
        'LogicalNode left or right branch produced an empty condition.',
        { nodeType: node.type }
      );
    }

    const joiner = node.operator === '&&' ? ' AND ' : ' OR ';
    return {
      condition: `(${left.condition}${joiner}${right.condition})`,
      parameters: [...left.parameters, ...right.parameters],
    };
  }
}
