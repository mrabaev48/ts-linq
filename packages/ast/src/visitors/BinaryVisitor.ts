import type { SqlParameter } from '@ts-linq/types';
import { AstSqlGenerationError } from '../errors';
import type { BinaryExpressionNode, MemberAccessNode, ParameterRefNode } from '../ast/Nodes';

export class BinaryVisitor {
  /**
   * Convert a binary comparison node into a SQL fragment.
   * Does not quote identifiers; relies on upstream mapping/quoting.
   */
  public visit(
    node: BinaryExpressionNode,
    inputParameters: readonly SqlParameter[] = []
  ): { condition: string; parameters: SqlParameter[] } {
    const column = this.renderMemberAccess(node.left);
    const value = this.resolveRight(node.right, inputParameters);
    const op = node.operator;
    return { condition: `(${column} ${op} ?)`, parameters: [value] };
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

  private resolveRight(
    node: BinaryExpressionNode['right'],
    inputParameters: readonly SqlParameter[]
  ): SqlParameter {
    if (node.type === 'Literal') return node.value;
    return this.resolveParameterRef(node, inputParameters);
  }

  private resolveParameterRef(
    node: ParameterRefNode,
    inputParameters: readonly SqlParameter[]
  ): SqlParameter {
    const idx = node.index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= inputParameters.length) {
      throw new AstSqlGenerationError(
        'PARAMETER_INDEX_OUT_OF_RANGE',
        `ParameterRef.index ${String(idx)} is out of range for inputParameters length ${String(
          inputParameters.length
        )}.`,
        { nodeType: node.type, parameterIndex: idx }
      );
    }
    return inputParameters[idx];
  }
}
