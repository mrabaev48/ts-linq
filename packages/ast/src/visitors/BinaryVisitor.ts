import type { BinaryExpressionNode } from '../ast/Nodes';
import type { SqlParameter } from '@ts-linq/types';

export class BinaryVisitor {
  public visit(node: BinaryExpressionNode): { condition: string; parameters: SqlParameter[] } {
    const column = node.left.name;
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
  }
}
