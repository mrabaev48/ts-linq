import type { IsNotNullNode, IsNullNode } from '@ts-linq/ast';

import type { ConditionFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';
import { renderPropertyName } from './BinaryVisitor';

/**
 * Handles both `IS NULL` and `IS NOT NULL` checks. A single `visit` method branches on the
 * node type so one visitor instance can be registered under both `'isNull'` and `'isNotNull'`.
 */
export class NullVisitor implements NodeVisitor<IsNullNode | IsNotNullNode> {
  public visit(node: IsNullNode | IsNotNullNode, ctx: VisitContext): ConditionFragment {
    const operator = node.type === 'isNull' ? 'IS NULL' : 'IS NOT NULL';
    return {
      condition: `(${renderPropertyName(node.property, ctx.resolver)} ${operator})`,
      parameters: []
    };
  }
}
