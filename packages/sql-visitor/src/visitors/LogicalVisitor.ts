import type { ExpressionNode, LogicalNode } from '@ts-linq/ast';
import type { ConditionFragment } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

export class LogicalVisitor {
  public visit(
    node: LogicalNode,
    recurse: (n: ExpressionNode) => ConditionFragment
  ): ConditionFragment {
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
      parameters: [...left.parameters, ...right.parameters]
    };
  }
}
