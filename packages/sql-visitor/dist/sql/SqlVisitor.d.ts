import type { ExpressionNode } from '@ts-linq/ast';
import type { SqlParameter } from '../types';
export declare class SqlVisitor {
  private readonly binary;
  private readonly logical;
  toSql(node: ExpressionNode): {
    condition: string;
    parameters: SqlParameter[];
  };
}
//# sourceMappingURL=SqlVisitor.d.ts.map
