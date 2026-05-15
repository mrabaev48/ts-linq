import type { IsNotNullNode, IsNullNode } from '@ts-linq/ast';
import { renderPropertyName, type ColumnResolver } from './BinaryVisitor';
import type { ConditionFragment } from '@ts-linq/ast';

export class NullVisitor {
  public visitIsNull(node: IsNullNode, resolver?: ColumnResolver): ConditionFragment {
    return { condition: `(${renderPropertyName(node.property, resolver)} IS NULL)`, parameters: [] };
  }

  public visitIsNotNull(node: IsNotNullNode, resolver?: ColumnResolver): ConditionFragment {
    return { condition: `(${renderPropertyName(node.property, resolver)} IS NOT NULL)`, parameters: [] };
  }
}
