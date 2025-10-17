import type { ExpressionNode, LogicalExpressionNode } from '../ast/Nodes';
import type { SqlParameter } from '@ts-linq/types';
export declare class LogicalVisitor {
    visit(node: LogicalExpressionNode, visit: (n: ExpressionNode) => {
        condition: string;
        parameters: SqlParameter[];
    }): {
        condition: string;
        parameters: SqlParameter[];
    };
}
//# sourceMappingURL=LogicalVisitor.d.ts.map