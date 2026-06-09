import type { IsNotNullNode, IsNullNode } from '@ts-linq/ast';

import type { ConditionFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';
import { renderPropertyName } from './BinaryVisitor';

/**
 * Handles both `IS NULL` and `IS NOT NULL` checks. A single `visit` method branches on the
 * node type so one visitor instance can be registered under both `'isNull'` and `'isNotNull'`.
 *
 * A JSON-owned nested property arrives as a `JsonPathExpression`; it is rendered through the
 * dialect's `JsonPathTranslator` via `ctx.recurse` (the same port `BinaryVisitor` uses) and
 * wrapped in the null-check operator. The translator yields zero parameters, so the null check
 * adds none.
 */
export class NullVisitor implements NodeVisitor<IsNullNode | IsNotNullNode> {
  public visit(node: IsNullNode | IsNotNullNode, ctx: VisitContext): ConditionFragment {
    const operator = node.type === 'isNull' ? 'IS NULL' : 'IS NOT NULL';
    if (node.property.type === 'jsonPath') {
      const inner = ctx.recurse(node.property);
      return { condition: `(${inner.condition} ${operator})`, parameters: inner.parameters };
    }
    return {
      condition: `(${renderPropertyName(node.property, ctx.resolver)} ${operator})`,
      parameters: []
    };
  }
}
