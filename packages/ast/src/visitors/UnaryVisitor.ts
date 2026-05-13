import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '../errors';
import type { ExpressionNode, NotNode } from '../ast/Nodes';
import { renderPropertyName, type ColumnResolver } from './BinaryVisitor';

export class UnaryVisitor {
  public visit(
    node: NotNode,
    recurse: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] },
    resolver?: ColumnResolver
  ): { condition: string; parameters: SqlParameter[] } {
    const operand = node.operand;

    // `!u.boolField` → `(col = false)`
    if (operand.type === 'property') {
      return { condition: `(${renderPropertyName(operand, resolver)} = ?)`, parameters: [false] };
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
