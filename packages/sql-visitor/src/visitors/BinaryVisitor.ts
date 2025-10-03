import type { BinaryExpressionNode } from '@ts-linq/ast';

export type SqlParameter = string | number | boolean | Date | Uint8Array | null;

export class BinaryVisitor {
  public visit(node: BinaryExpressionNode): { condition: string; parameters: SqlParameter[] } {
    const column = node.left.name;
    const value = node.right.value;
    const op = node.operator;
    return { condition: `${column} ${op} ?`, parameters: [value] };
  }
}
