import type { NotNode } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

import type { ConditionFragment } from '../types';
import type { NodeVisitor, VisitContext } from '../visitContext';
import { renderPropertyName } from './BinaryVisitor';

export class UnaryVisitor implements NodeVisitor<NotNode> {
  public visit(node: NotNode, ctx: VisitContext): ConditionFragment {
    const { resolver, state } = ctx;
    const operand = node.operand;

    // `!u.boolField` → `(col = false)`
    if (operand.type === 'property') {
      return {
        condition: `(${renderPropertyName(operand, resolver)} = ${state.next()})`,
        parameters: [false]
      };
    }

    // `!(expr)` → `(NOT expr)`
    if (
      operand.type === 'binary' ||
      operand.type === 'logical' ||
      operand.type === 'not' ||
      operand.type === 'isNull' ||
      operand.type === 'isNotNull' ||
      operand.type === 'in' ||
      operand.type === 'method'
    ) {
      const inner = ctx.recurse(operand);
      return { condition: `(NOT ${inner.condition})`, parameters: inner.parameters };
    }

    throw new AstSqlGenerationError(
      'INVALID_UNARY_OPERAND',
      `Invalid NOT operand type: '${operand.type}'.`,
      { nodeType: node.type, operandType: operand.type }
    );
  }
}
