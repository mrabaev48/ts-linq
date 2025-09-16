import type { ExpressionNode } from './Nodes';
import type { SqlParameter } from '../../types';
/**
 * Visitor that turns a supported AST into a SQL WHERE fragment with parameters.
 * Does not quote identifiers; relies on upstream mapping to column names.
 */
export declare class SqlVisitor {
    /**
     * Convert an AST node to a SQL WHERE fragment and parameters.
     */
    toSql(node: ExpressionNode): {
        condition: string;
        parameters: SqlParameter[];
    };
    /**
     * Handle a binary comparison node.
     */
    private visitBinary;
    /**
     * Handle a logical AND/OR node by concatenating child results.
     */
    private visitLogical;
}
//# sourceMappingURL=SqlVisitor.d.ts.map