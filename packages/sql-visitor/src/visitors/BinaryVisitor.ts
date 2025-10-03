import type { BinaryExpressionNode } from '@ts-linq/ast';
import type { SqlParameter } from '../types';

export class BinaryVisitor {
  public visit(node: BinaryExpressionNode): { condition: string; parameters: SqlParameter[] } {
    const column = node.left.name;
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
  }
}
