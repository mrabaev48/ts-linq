import type { SqlParameter } from '@ts-linq/types';
import type { IsNotNullNode, IsNullNode } from '../ast/Nodes';
import { renderPropertyName } from './BinaryVisitor';

export class NullVisitor {
  public visitIsNull(node: IsNullNode): { condition: string; parameters: SqlParameter[] } {
    return { condition: `(${renderPropertyName(node.property)} IS NULL)`, parameters: [] };
  }

  public visitIsNotNull(node: IsNotNullNode): { condition: string; parameters: SqlParameter[] } {
    return { condition: `(${renderPropertyName(node.property)} IS NOT NULL)`, parameters: [] };
  }
}
