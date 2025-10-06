import type { ExpressionNode } from '@ts-linq/ast';
import type { SqlParameter } from '../types';
/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export declare class SqlVisitor {
  private readonly binary;
  private readonly logical;
  /**
   * Convert an AST node to a SQL WHERE fragment and parameters.
   */
  toSql(node: ExpressionNode): {
    condition: string;
    parameters: SqlParameter[];
  };
}
//# sourceMappingURL=SqlVisitor.d.ts.map
