import type { IsNotNullNode, IsNullNode } from '@ts-linq/ast';
import type { ConditionFragment } from '@ts-linq/ast';

import { type ColumnResolver, renderPropertyName } from './BinaryVisitor';

export class NullVisitor {
  public visitIsNull(node: IsNullNode, resolver?: ColumnResolver): ConditionFragment {
    return {
      condition: `(${renderPropertyName(node.property, resolver)} IS NULL)`,
      parameters: []
    };
  }

  public visitIsNotNull(node: IsNotNullNode, resolver?: ColumnResolver): ConditionFragment {
    return {
      condition: `(${renderPropertyName(node.property, resolver)} IS NOT NULL)`,
      parameters: []
    };
  }
}
