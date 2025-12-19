import type { BinaryExpressionNode } from '../ast/Nodes';
import type { SqlParameter } from '@ts-linq/types';

export class BinaryVisitor {
  /**
   * @param quoteIdentifier - Optional function to quote identifiers for dialect-specific SQL
   */
  public visit(
    node: BinaryExpressionNode,
    quoteIdentifier?: (name: string) => string
  ): { condition: string; parameters: SqlParameter[] } {
    const column = node.left.name;
    const value = node.right.value;
    const op = node.operator;
    const quotedColumn = quoteIdentifier ? quoteIdentifier(column) : column;
    return { condition: `${quotedColumn} ${op} ?`, parameters: [value] };
  }
}
