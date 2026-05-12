import type { SqlParameter } from '@ts-linq/types';

import { AstSqlGenerationError } from '../errors';
import type { ExpressionNode, MemberAccessNode, UnaryExpressionNode } from '../ast/Nodes';

export class UnaryVisitor {
  /**
   * Convert a unary expression to SQL.
   *
   * Semantics:
   * - `!MemberAccess` is rendered as `(<col> = ?)` with parameter `false`.
   * - `!(<expr>)` is rendered as `(NOT <exprSql>)`.
   */
  public visit(
    node: UnaryExpressionNode,
    visit: (n: ExpressionNode) => { condition: string; parameters: SqlParameter[] }
  ): { condition: string; parameters: SqlParameter[] } {
    if (node.operator !== 'NOT') {
      throw new AstSqlGenerationError(
        'UNSUPPORTED_NODE_TYPE',
        `Unsupported unary operator: '${node.operator}'.`,
        { nodeType: node.type }
      );
    }

    const operand = node.operand;
    if (operand.type === 'MemberAccess') {
      const column = this.renderMemberAccess(operand);
      return { condition: `(${column} = ?)`, parameters: [false] };
    }

    if (operand.type === 'BinaryExpression' || operand.type === 'LogicalExpression' || operand.type === 'UnaryExpression') {
      const inner = visit(operand);
      return { condition: `(NOT ${inner.condition})`, parameters: inner.parameters };
    }

    throw new AstSqlGenerationError(
      'INVALID_UNARY_OPERAND',
      `Invalid unary NOT operand type: '${operand.type}'.`,
      { nodeType: node.type, operandType: operand.type }
    );
  }

  private renderMemberAccess(node: MemberAccessNode): string {
    if (node.path.length === 0) {
      throw new AstSqlGenerationError(
        'INVALID_MEMBER_ACCESS_PATH',
        'MemberAccess.path must contain at least one segment.',
        { nodeType: node.type, memberPath: node.path }
      );
    }
    for (const seg of node.path) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(seg)) {
        throw new AstSqlGenerationError(
          'INVALID_MEMBER_ACCESS_PATH',
          `Invalid member access path segment: '${seg}'.`,
          { nodeType: node.type, memberPath: node.path }
        );
      }
    }
    return node.path.join('.');
  }
}

