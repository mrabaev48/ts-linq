import type { ExpressionNode, NotNode } from '@ts-linq/ast';
import type { ConditionFragment } from '@ts-linq/ast';
import { AstSqlGenerationError } from '@ts-linq/ast';

import { ParameterState, ParameterStyle } from '../ParameterStyle';
import { type ColumnResolver, renderPropertyName } from './BinaryVisitor';

export class UnaryVisitor {
  public visit(
    node: NotNode,
    recurse: (n: ExpressionNode) => ConditionFragment,
    resolver?: ColumnResolver,
    state: ParameterState = new ParameterState(ParameterStyle.Question)
  ): ConditionFragment {
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
      const inner = recurse(operand);
      return { condition: `(NOT ${inner.condition})`, parameters: inner.parameters };
    }

    throw new AstSqlGenerationError(
      'INVALID_UNARY_OPERAND',
      `Invalid NOT operand type: '${operand.type}'.`,
      { nodeType: node.type, operandType: operand.type }
    );
  }
}
