import type { SqlParameter } from '@ts-linq/types';
import type { IsNotNullNode, IsNullNode } from '../ast/Nodes';
import { renderPropertyName, type ColumnResolver } from './BinaryVisitor';

export class NullVisitor {
  public visitIsNull(node: IsNullNode, resolver?: ColumnResolver): { condition: string; parameters: SqlParameter[] } {
    return { condition: `(${renderPropertyName(node.property, resolver)} IS NULL)`, parameters: [] };
  }

  public visitIsNotNull(node: IsNotNullNode, resolver?: ColumnResolver): { condition: string; parameters: SqlParameter[] } {
    return { condition: `(${renderPropertyName(node.property, resolver)} IS NOT NULL)`, parameters: [] };
  }
}
