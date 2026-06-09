import type { LogicalNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

import type { ConditionFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';

export class LogicalVisitor implements NodeVisitor<LogicalNode> {
  public visit(node: LogicalNode, ctx: VisitContext): ConditionFragment {
    const left = ctx.recurse(node.left);
    const right = ctx.recurse(node.right);

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
