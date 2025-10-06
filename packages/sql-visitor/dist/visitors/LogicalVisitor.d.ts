import type { ExpressionNode, LogicalExpressionNode } from '@ts-linq/ast';
import type { SqlParameter } from '../types';
export declare class LogicalVisitor {
  visit(
    node: LogicalExpressionNode,
    visit: (n: ExpressionNode) => {
      condition: string;
      parameters: SqlParameter[];
    }
  ): {
    condition: string;
    parameters: SqlParameter[];
  };
}
//# sourceMappingURL=LogicalVisitor.d.ts.map
